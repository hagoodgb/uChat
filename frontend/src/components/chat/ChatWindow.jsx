import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";
import CharacterChips from "./CharacterChips.jsx";
import PinnedImageRail from "./PinnedImageRail.jsx";
import { useStore } from "../../store/useStore.js";
import { api, streamCompletion, streamCharacterCompletion } from "../../lib/api.js";
import { selectRespondingCharacters } from "../../lib/groupChat.js";

const newId = () => crypto.randomUUID();

export default function ChatWindow() {
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const activeModel = useStore((s) => s.activeModel);
  const settingsValues = useStore((s) => s.settingsValues);
  const messages = useStore((s) => s.messages);
  const appendMessage = useStore((s) => s.appendMessage);
  const updateLastMessage = useStore((s) => s.updateLastMessage);
  const updateMessageAt = useStore((s) => s.updateMessageAt);
  const removeMessageAt = useStore((s) => s.removeMessageAt);
  const activeChatId = useStore((s) => s.activeChatId);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const activeChatMeta = useStore((s) => s.activeChatMeta);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const characters = useStore((s) => s.characters);
  const personas = useStore((s) => s.personas);
  const activePersonaId = useStore((s) => s.activePersonaId);
  const pinnedAvatars = useStore((s) => s.pinnedAvatars);
  const togglePinnedAvatar = useStore((s) => s.togglePinnedAvatar);

  const [isStreaming, setIsStreaming] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const scrollRef = useRef(null);
  // A single in-flight generation's AbortController, and a flag so Stop can
  // also cut short a multi-character group auto-response sequence rather
  // than just the one character currently generating.
  const abortControllerRef = useRef(null);
  const stopRequestedRef = useRef(false);

  // Memoized: these lookups get rebuilt on every render otherwise, including
  // every single streamed token during generation.
  const characterMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);
  const activePersona = useMemo(
    () => personas.find((p) => p.id === activePersonaId) || null,
    [personas, activePersonaId]
  );
  const pinnedKeys = useMemo(() => new Set(pinnedAvatars.map((p) => p.key)), [pinnedAvatars]);
  // Fills left, right, left, right... so clicks 1/3/5 land left and 2/4 land right.
  const leftPinned = pinnedAvatars.filter((_, i) => i % 2 === 0);
  const rightPinned = pinnedAvatars.filter((_, i) => i % 2 === 1);

  const isCharacterChat = activeChatMeta?.kind === "character" && activeChatMeta.characterIds?.[0];
  const isGroupChat = activeChatMeta?.kind === "group" && activeChatMeta.characterIds?.length > 0;
  const activeCharacter = isCharacterChat ? characterMap.get(activeChatMeta.characterIds[0]) : null;
  const groupCharacters = isGroupChat
    ? activeChatMeta.characterIds.map((id) => characterMap.get(id)).filter(Boolean)
    : [];

  const modelForCharacter = (characterId) =>
    isGroupChat ? activeChatMeta.modelMap?.[characterId] || activeModel : activeModel;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const ensureChat = async () => {
    if (activeChatId) return activeChatId;
    const chat = await api.createChat({
      title: "New chat",
      kind: "blank",
      connectionId: activeConnectionId,
    });
    setActiveChatId(chat.id);
    setActiveChatMeta({ kind: "blank", characterIds: [], scenario: null });
    return chat.id;
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
  };

  // Runs one character's reply and appends/streams it into the message list.
  // Shared by single character chats, group auto-responses, and manual
  // avatar-click triggers.
  const runCharacterReply = async (chatId, characterId, scenarioOverride, model) => {
    const messageId = newId();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRespondingId(characterId);
    appendMessage({ id: messageId, role: "assistant", content: "", streaming: true, characterId });
    setIsStreaming(true);
    await new Promise((resolve) => {
      streamCharacterCompletion(
        {
          connectionId: activeConnectionId,
          model: model || activeModel,
          settings: settingsValues,
          chatId,
          characterId,
          scenarioOverride,
          personaId: activePersonaId,
          messageId,
        },
        {
          onDelta: (delta) => updateLastMessage((m) => ({ ...m, content: m.content + delta })),
          onDone: (evt) => {
            updateLastMessage((m) => ({
              ...m,
              streaming: false,
              id: evt.messageId ?? m.id,
              variantIndex: evt.variantIndex ?? m.variantIndex,
              variantCount: evt.variantCount ?? m.variantCount,
            }));
            resolve();
          },
          onError: (err) => {
            updateLastMessage((m) => ({
              ...m,
              content: m.content || `⚠ ${err.message}`,
              streaming: false,
              error: true,
            }));
            resolve();
          },
          signal: controller.signal,
        }
      );
    });
    setRespondingId(null);
    setIsStreaming(false);
  };

  // Blank-chat equivalent of runCharacterReply — no character card, plain
  // completion over whatever history is passed in.
  const runBlankReply = async (chatId, history) => {
    const messageId = newId();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    appendMessage({ id: messageId, role: "assistant", content: "", streaming: true });
    setIsStreaming(true);
    await new Promise((resolve) => {
      streamCompletion(
        {
          connectionId: activeConnectionId,
          model: activeModel,
          settings: settingsValues,
          chatId,
          messages: history,
          messageId,
        },
        {
          onDelta: (delta) => updateLastMessage((m) => ({ ...m, content: m.content + delta })),
          onDone: (evt) => {
            updateLastMessage((m) => ({ ...m, streaming: false, id: evt.messageId ?? m.id }));
            resolve();
          },
          onError: (err) => {
            updateLastMessage((m) => ({
              ...m,
              content: m.content || `⚠ ${err.message}`,
              streaming: false,
              error: true,
            }));
            resolve();
          },
          signal: controller.signal,
        }
      );
    });
    setIsStreaming(false);
  };

  const handleSend = async (text) => {
    if (!activeConnectionId || !activeModel) return;
    stopRequestedRef.current = false;
    const chatId = await ensureChat();

    const userMsgIndex = messages.length;
    appendMessage({ role: "user", content: text });
    const saved = await api.postMessage(chatId, { role: "user", content: text });
    updateMessageAt(userMsgIndex, (m) => ({ ...m, id: saved.id }));

    if (isGroupChat) {
      if (activeChatMeta.responseMode === "manual") return; // wait for an avatar click
      const order = selectRespondingCharacters(
        groupCharacters,
        text,
        messages.filter((m) => m.role === "assistant")
      );
      for (const characterId of order) {
        if (stopRequestedRef.current) break;
        await runCharacterReply(chatId, characterId, null, modelForCharacter(characterId));
      }
      return;
    }

    if (isCharacterChat) {
      await runCharacterReply(chatId, activeChatMeta.characterIds[0], activeChatMeta.scenario || undefined);
      return;
    }

    const history = [...messages, { role: "user", content: text }].map(({ role, content }) => ({ role, content }));
    await runBlankReply(chatId, history);
  };

  const handleAvatarTrigger = async (characterId) => {
    if (isStreaming || !activeChatId) return;
    stopRequestedRef.current = false;
    await runCharacterReply(activeChatId, characterId, null, modelForCharacter(characterId));
  };

  const handleEditMessage = async (index, newContent) => {
    const msg = messages[index];
    if (!msg?.id || !activeChatId) return;
    await api.updateMessage(activeChatId, msg.id, newContent);
    updateMessageAt(index, (m) => ({ ...m, content: newContent }));
  };

  const handleDeleteMessage = async (index) => {
    const msg = messages[index];
    if (!msg?.id || !activeChatId) return;
    await api.deleteMessage(activeChatId, msg.id);
    removeMessageAt(index);
  };

  const handleReroll = async (index) => {
    const msg = messages[index];
    if (!msg?.id || !activeChatId || isStreaming) return;
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    // Replace in place — content is cleared and re-streamed into the SAME
    // row (via rerollMessageId), so the message keeps its original position
    // in the chat rather than jumping to the end. Every earlier attempt is
    // kept as a variant the person can swipe back to.
    updateMessageAt(index, (m) => ({ ...m, content: "", streaming: true }));

    await new Promise((resolve) => {
      const handlers = {
        onDelta: (delta) => updateMessageAt(index, (m) => ({ ...m, content: m.content + delta })),
        onDone: (evt) => {
          updateMessageAt(index, (m) => ({
            ...m,
            streaming: false,
            variantIndex: evt.variantIndex ?? m.variantIndex,
            variantCount: evt.variantCount ?? m.variantCount,
          }));
          resolve();
        },
        onError: (err) => {
          updateMessageAt(index, (m) => ({ ...m, content: `⚠ ${err.message}`, streaming: false }));
          resolve();
        },
        signal: controller.signal,
      };
      if (msg.characterId) {
        streamCharacterCompletion(
          {
            connectionId: activeConnectionId,
            model: modelForCharacter(msg.characterId),
            settings: settingsValues,
            chatId: activeChatId,
            characterId: msg.characterId,
            scenarioOverride: isCharacterChat ? activeChatMeta.scenario || undefined : undefined,
            rerollMessageId: msg.id,
            personaId: activePersonaId,
          },
          handlers
        );
      } else {
        const history = messages.slice(0, index).map(({ role, content }) => ({ role, content }));
        streamCompletion(
          {
            connectionId: activeConnectionId,
            model: activeModel,
            settings: settingsValues,
            chatId: activeChatId,
            messages: history,
            rerollMessageId: msg.id,
          },
          handlers
        );
      }
    });
    setIsStreaming(false);
  };

  const handleContinue = async (index) => {
    const msg = messages[index];
    if (!msg?.id || !activeChatId || isStreaming) return;
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    updateMessageAt(index, (m) => ({ ...m, streaming: true }));

    await new Promise((resolve) => {
      const handlers = {
        onDelta: (delta) => updateMessageAt(index, (m) => ({ ...m, content: m.content + delta })),
        onDone: () => {
          updateMessageAt(index, (m) => ({ ...m, streaming: false }));
          resolve();
        },
        onError: (err) => {
          updateMessageAt(index, (m) => ({ ...m, streaming: false }));
          resolve();
        },
        signal: controller.signal,
      };
      if (msg.characterId) {
        streamCharacterCompletion(
          {
            connectionId: activeConnectionId,
            model: modelForCharacter(msg.characterId),
            settings: settingsValues,
            chatId: activeChatId,
            characterId: msg.characterId,
            scenarioOverride: isCharacterChat ? activeChatMeta.scenario || undefined : undefined,
            continueMessageId: msg.id,
            personaId: activePersonaId,
          },
          handlers
        );
      } else {
        const history = messages.slice(0, index + 1).map(({ role, content }) => ({ role, content }));
        streamCompletion(
          {
            connectionId: activeConnectionId,
            model: activeModel,
            settings: settingsValues,
            chatId: activeChatId,
            messages: history,
            continueMessageId: msg.id,
          },
          handlers
        );
      }
    });
    setIsStreaming(false);
  };

  // Swipe to a different variant — an alternate greeting, or an earlier/
  // later reroll. Whatever's active becomes both what's shown AND what
  // feeds context to future messages; the rest stay saved, just inactive.
  const handleSwipeVariant = async (index, targetIndex) => {
    const msg = messages[index];
    if (!msg?.id || !activeChatId) return;
    const updated = await api.setMessageVariant(activeChatId, msg.id, targetIndex);
    updateMessageAt(index, (m) => ({
      ...m,
      content: updated.content,
      variantIndex: updated.variantIndex,
      variantCount: updated.variantCount,
    }));
  };

  const ready = !!activeConnectionId && !!activeModel;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PinnedImageRail side="left" items={leftPinned} onToggle={(key) => togglePinnedAvatar({ key })} />
      <PinnedImageRail side="right" items={rightPinned} onToggle={(key) => togglePinnedAvatar({ key })} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
            <Sparkles size={22} className="text-brass" />
            <p className="text-sm">
              {ready
                ? "Say something to start the chat."
                : "Connect to a provider and pick a model to begin."}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const character = m.characterId ? characterMap.get(m.characterId) : null;
              const speakerName = isUser ? activePersona?.name : character?.name;
              const speakerAvatarUrl = isUser ? activePersona?.avatarUrl : character?.avatarUrl;
              const avatarKey = isUser ? (activePersona ? "persona" : null) : character ? `char:${character.id}` : null;
              return (
                <MessageBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  streaming={m.streaming}
                  isLast={i === messages.length - 1}
                  disabled={isStreaming}
                  speakerName={speakerName}
                  speakerAvatarUrl={speakerAvatarUrl}
                  avatarPinned={avatarKey ? pinnedKeys.has(avatarKey) : false}
                  onAvatarClick={
                    avatarKey
                      ? () => togglePinnedAvatar({ key: avatarKey, name: speakerName, avatarUrl: speakerAvatarUrl })
                      : undefined
                  }
                  variantIndex={m.variantIndex ?? 0}
                  variantCount={m.variantCount ?? 1}
                  onSwipeLeft={() => handleSwipeVariant(i, (m.variantIndex ?? 0) - 1)}
                  onSwipeRight={() => handleSwipeVariant(i, (m.variantIndex ?? 0) + 1)}
                  onEdit={(newContent) => handleEditMessage(i, newContent)}
                  onDelete={() => handleDeleteMessage(i)}
                  onContinue={() => handleContinue(i)}
                  onReroll={() => handleReroll(i)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {isGroupChat && (
          <CharacterChips
            characters={groupCharacters}
            onTrigger={handleAvatarTrigger}
            disabled={isStreaming || !activeChatId}
            respondingId={respondingId}
          />
        )}
        <MessageInput
          onSend={handleSend}
          disabled={!ready || isStreaming}
          isStreaming={isStreaming}
          onStop={handleStop}
          placeholder={
            activeCharacter
              ? `Message ${activeCharacter.name}... (*actions* and "speech" get styled automatically)`
              : isGroupChat
              ? isStreaming
                ? undefined
                : "Message the group..."
              : undefined
          }
        />
      </div>
    </div>
  );
}
