import { useState } from "react";
import { Sparkles, PenLine, Wand2 } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { useStore } from "../../store/useStore.js";
import { api, streamCharacterCompletion, streamCompletion } from "../../lib/api.js";
import { replaceMacros } from "../../lib/macros.js";

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
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const setMessages = useStore((s) => s.setMessages);
  const closeOverlay = useStore((s) => s.closeOverlay);

  const [scenarioMode, setScenarioMode] = useState(character ? "default" : "custom");
  const [scenarioText, setScenarioText] = useState("");
  const [greetingMode, setGreetingMode] = useState("write"); // 'write' | 'auto'
  const [starting, setStarting] = useState(false);

  const ready = !!activeConnectionId && !!activeModel;

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

      if (character && scenarioMode === "default") {
        // Seed ALL of the card's greetings (firstMes + alternates) as
        // swipeable variants up front — no extra generation needed to
        // browse them. Macros are resolved now, at insertion time, so the
        // person never sees a literal "{{user}}"/"{{char}}" in chat.
        const personaName = personas.find((p) => p.id === activePersonaId)?.name;
        const macroCtx = { charName: character.name, personaName };
        const rawVariants = [character.firstMes, ...(character.alternateGreetings || [])].filter(Boolean);
        const variants = rawVariants.map((v) => replaceMacros(v, macroCtx));
        const greeting = variants[0] || `*${character.name} says nothing yet.*`;
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
            variantCount: variants.length || 1,
          },
        ]);
      } else if (useCustomScenario && greetingMode === "auto") {
        const greetingMsgId = crypto.randomUUID();
        setMessages([{ id: greetingMsgId, role: "assistant", content: "", streaming: true }]);
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
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + delta };
                return msgs;
              });
            },
            onDone: (evt) => {
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  streaming: false,
                  id: evt.messageId ?? msgs[msgs.length - 1].id,
                };
                return msgs;
              });
              resolve();
            },
            onError: (err) => {
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: `⚠ ${err.message}`, streaming: false };
                return msgs;
              });
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

      closeOverlay();
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
