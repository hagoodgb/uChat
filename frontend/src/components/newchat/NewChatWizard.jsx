import { useState } from "react";
import { Sparkles, PenLine, Wand2, BookOpen } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { useStore } from "../../store/useStore.js";
import { api, streamCharacterCompletion, streamCompletion } from "../../lib/api.js";
import { replaceMacros } from "../../lib/macros.js";
import { generateId } from "../../lib/id.js";

// Launched either with a specific character (start-chat-with-card) or with
// character=null (blank chat). Handles the scenario override + greeting
// choice described in the spec: default greeting vs custom scenario, and
// within a custom scenario, user-written vs auto-generated opening line.

function OptionCard({ selected, onClick, icon: Icon, title, description }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition ${
        selected ? "border-brass bg-brass/10" : "border-hairline hover:border-hairline/80 hover:bg-panel2"
      }`}
    >
      <Icon size={18} className={selected ? "text-brass" : "text-muted"} />
      <span className="text-sm font-medium text-ink">{title}</span>
      <span className="text-xs text-muted">{description}</span>
    </button>
  );
}

export default function NewChatWizard({ character, onClose }) {
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const activeModel = useStore((s) => s.activeModel);
  const settingsValues = useStore((s) => s.settingsValues);
  const activePersonaId = useStore((s) => s.activePersonaId);
  const personas = useStore((s) => s.personas);
  const lorebooks = useStore((s) => s.lorebooks);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const setMessages = useStore((s) => s.setMessages);
  const updateLastMessage = useStore((s) => s.updateLastMessage);
  const closeOverlay = useStore((s) => s.closeOverlay);

  const [scenarioMode, setScenarioMode] = useState(character ? "default" : "custom");
  const [scenarioText, setScenarioText] = useState("");
  const [greetingMode, setGreetingMode] = useState("write"); // 'write' | 'auto'
  const [selectedLorebookIds, setSelectedLorebookIds] = useState([]);
  const [starting, setStarting] = useState(false);

  const ready = !!activeConnectionId && !!activeModel;
  const toggleLorebook = (id) =>
    setSelectedLorebookIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const start = async () => {
    if (!ready) return;
    setStarting(true);
    try {
      const useCustomScenario = scenarioMode === "custom" && scenarioText.trim();
      const chat = await api.createChat({
        title: character ? character.name : "New chat",
        kind: character ? "character" : "blank",
        characterIds: character ? [character.id] : [],
        connectionId: activeConnectionId,
        scenario: useCustomScenario ? { text: scenarioText.trim() } : null,
      });

      setActiveChatId(chat.id);
      setActiveChatMeta({
        kind: chat.kind,
        characterIds: chat.characterIds,
        scenario: chat.scenario?.text || null,
      });
      setMessages([]);
      for (const lorebookId of selectedLorebookIds) {
        api.attachLorebookToChat(lorebookId, chat.id).catch(() => {});
      }

      // Close right away — everything below this point only touches the
      // global store, which the now-visible ChatWindow renders live, the
      // same way any other streaming reply shows up. There's no reason to
      // keep this modal open and blocking for however long generation
      // takes; leaving it open was what let someone get impatient, close
      // it mid-stream, and orphan this function while it kept mutating
      // state behind an already-dismissed UI.
      closeOverlay();

      if (character && scenarioMode === "default") {
        // Seed ALL of the card's greetings (firstMes + alternates) as
        // swipeable variants up front — no extra generation needed to
        // browse them. Macros are resolved now, at insertion time, so the
        // person never sees a literal "{{user}}"/"{{char}}" in chat.
        const personaName = personas.find((p) => p.id === activePersonaId)?.name;
        const macroCtx = { charName: character.name, personaName };
        const rawVariants = [character.firstMes, ...(character.alternateGreetings || [])].filter(Boolean);
        if (rawVariants.length > 0) {
          const variants = rawVariants.map((v) => replaceMacros(v, macroCtx));
          const greeting = variants[0];
          const saved = await api.postMessage(chat.id, {
            role: "assistant",
            content: greeting,
            characterId: character.id,
            variants: variants.length > 1 ? variants : undefined,
          });
          setMessages([
            {
              id: saved.id,
              role: "assistant",
              content: greeting,
              characterId: character.id,
              variantIndex: 0,
              variantCount: variants.length,
            },
          ]);
        }
        // else: character has no greeting defined at all — leave the chat
        // completely blank rather than inserting a placeholder line.
      } else if (useCustomScenario && greetingMode === "auto") {
        const greetingMsgId = generateId();
        setMessages([
          { id: greetingMsgId, role: "assistant", content: "", streaming: true, characterId: character?.id },
        ]);
        await new Promise((resolve) => {
          const commonArgs = {
            connectionId: activeConnectionId,
            model: activeModel,
            settings: settingsValues,
            chatId: chat.id,
            messageId: greetingMsgId,
          };
          const handlers = {
            onDelta: (delta) => {
              updateLastMessage((m) => ({ ...m, content: m.content + delta }));
            },
            onDone: (evt) => {
              updateLastMessage((m) => ({ ...m, streaming: false, id: evt.messageId ?? m.id }));
              resolve();
            },
            onError: (err) => {
              updateLastMessage((m) => ({ ...m, content: `⚠ ${err.message}`, streaming: false }));
              resolve();
            },
          };
          if (character) {
            streamCharacterCompletion(
              {
                ...commonArgs,
                characterId: character.id,
                scenarioOverride: scenarioText.trim(),
                generateGreeting: true,
                personaId: activePersonaId,
              },
              handlers
            );
          } else {
            streamCompletion(
              {
                ...commonArgs,
                messages: [
                  { role: "system", content: `Scenario: ${scenarioText.trim()}` },
                  { role: "user", content: "Begin the scene with an opening message." },
                ],
              },
              handlers
            );
          }
        });
      }
      // else: blank start (manual greeting) — nothing to seed, user types first.
    } catch (err) {
      alert(`Failed to start chat: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Overlay
      title={character ? `Start chat with ${character.name}` : "New blank chat"}
      subtitle="Override the character's default opening with your own scenario, if you like."
      onClose={onClose}
    >
      {!ready && (
        <p className="mb-4 rounded-md border border-hairline bg-panel2 px-3 py-2 text-xs text-muted">
          Connect to a provider and pick a model first (Connections menu).
        </p>
      )}

      {character && (
        <div className="mb-4 flex gap-2">
          <OptionCard
            selected={scenarioMode === "default"}
            onClick={() => setScenarioMode("default")}
            icon={Sparkles}
            title="Use default greeting"
            description={`Start with ${character.name}'s card greeting.`}
          />
          <OptionCard
            selected={scenarioMode === "custom"}
            onClick={() => setScenarioMode("custom")}
            icon={PenLine}
            title="Custom scenario"
            description="Override with your own starting scene."
          />
        </div>
      )}

      {scenarioMode === "custom" && (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted">Scenario / starting scene</label>
            <textarea
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
              rows={4}
              placeholder="e.g. It's midnight in a rain-slicked cyberpunk alley. The user has just walked in, wounded..."
              className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
            />
          </div>
          <div className="mb-2 flex gap-2">
            <OptionCard
              selected={greetingMode === "write"}
              onClick={() => setGreetingMode("write")}
              icon={PenLine}
              title="I'll write the opening"
              description="Start blank — type the first message yourself."
            />
            <OptionCard
              selected={greetingMode === "auto"}
              onClick={() => setGreetingMode("auto")}
              icon={Wand2}
              title="Auto-generate greeting"
              description="Let the model open the scene for you."
            />
          </div>
        </>
      )}

      {lorebooks.length > 0 && (
        <div className="mb-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <BookOpen size={12} /> Lorebooks for this chat (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {lorebooks.map((lb) => (
              <button
                key={lb.id}
                onClick={() => toggleLorebook(lb.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selectedLorebookIds.includes(lb.id)
                    ? "border-brass bg-brass/15 text-brass"
                    : "border-hairline text-muted hover:text-ink"
                }`}
              >
                {lb.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-hairline">
            In addition to whatever lorebooks the character already has attached.
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-hairline pt-4">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink">
          Cancel
        </button>
        <button
          onClick={start}
          disabled={!ready || starting}
          className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
        >
          {starting ? "Starting..." : "Start chat"}
        </button>
      </div>
    </Overlay>
  );
}
