import { useEffect } from "react";
import TopBar from "./components/TopBar.jsx";
import ChatWindow from "./components/chat/ChatWindow.jsx";
import ConnectionsOverlay from "./components/overlays/ConnectionsOverlay.jsx";
import SettingsOverlay from "./components/overlays/SettingsOverlay.jsx";
import CharactersOverlay from "./components/overlays/CharactersOverlay.jsx";
import HistoryOverlay from "./components/overlays/HistoryOverlay.jsx";
import GroupChatOverlay from "./components/overlays/GroupChatOverlay.jsx";
import PersonasOverlay from "./components/overlays/PersonasOverlay.jsx";
import LorebooksOverlay from "./components/overlays/LorebooksOverlay.jsx";
import { useStore } from "./store/useStore.js";
import { api } from "./lib/api.js";

export default function App() {
  const activeOverlay = useStore((s) => s.activeOverlay);
  const setCharacters = useStore((s) => s.setCharacters);
  const setPersonas = useStore((s) => s.setPersonas);
  const setLorebooks = useStore((s) => s.setLorebooks);

  // Characters, personas, and lorebooks are needed globally (e.g. chat
  // bubbles show speaker names/avatars even when their overlays aren't open).
  useEffect(() => {
    api.listCharacters().then(setCharacters).catch(() => {});
    api.listPersonas().then(setPersonas).catch(() => {});
    api.listLorebooks().then(setLorebooks).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen flex-col bg-base">
      <TopBar />
      <ChatWindow />

      {activeOverlay === "connections" && <ConnectionsOverlay />}
      {activeOverlay === "settings" && <SettingsOverlay />}
      {activeOverlay === "characters" && <CharactersOverlay />}
      {activeOverlay === "personas" && <PersonasOverlay />}
      {activeOverlay === "lorebooks" && <LorebooksOverlay />}
      {activeOverlay === "group" && <GroupChatOverlay />}
      {activeOverlay === "history" && <HistoryOverlay />}
    </div>
  );
}
