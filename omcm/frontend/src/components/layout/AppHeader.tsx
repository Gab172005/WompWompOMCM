import { useState, useRef, useEffect } from "react";
import {
  HeartPulse,
  Search,
  SlidersHorizontal,
  CloudRain,
  Bot,
  RotateCcw,
  X,
} from "lucide-react";
import type { ComputedMunicipality } from "../../services/lagunaData";

interface AppHeaderProps {
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  onSelectMunicipality: (psgc: string | null) => void;
  simulationMode: boolean;
  onToggleSimulation: () => void;
  optimizationOpen: boolean;
  onToggleOptimization: () => void;
  chatbotOpen: boolean;
  onToggleChatbot: () => void;
  onRecenter: () => void;
}

export function AppHeader({
  municipalities,
  selectedPsgc,
  onSelectMunicipality,
  simulationMode,
  onToggleSimulation,
  optimizationOpen,
  onToggleOptimization,
  chatbotOpen,
  onToggleChatbot,
  onRecenter,
}: AppHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const filtered = municipalities.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none gap-3">
      {/* Brand & Search Box */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Brand Card */}
        <div className="flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-4 py-2.5 rounded-xl shadow-xl text-white">
          <div className="w-8 h-8 rounded-lg bg-red-600/90 flex items-center justify-center text-white shadow-inner">
            <HeartPulse size={20} className="animate-pulse" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm text-slate-100">
              <span>OMCM</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-1.5 py-0.5 rounded border border-sky-400/30">
                LAGUNA ONLY
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Mobile Clinic Mapper
            </div>
          </div>
        </div>

        {/* Municipality Search Bar */}
        <div ref={searchBoxRef} className="relative w-64 md:w-80">
          <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 shadow-xl focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 transition-all">
            <Search size={16} className="text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search Laguna municipality..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDropdownOpen(false);
                }}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {dropdownOpen && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl z-50 divide-y divide-slate-800/80">
              {filtered.length > 0 ? (
                filtered.map((m) => (
                  <button
                    key={m.psgc}
                    onClick={() => {
                      onSelectMunicipality(m.psgc);
                      setSearchQuery(m.name);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-slate-800/90 transition-colors ${
                      selectedPsgc === m.psgc ? "bg-sky-950/60 text-sky-300" : "text-slate-200"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{m.name}</span>
                      <span className="ml-1.5 text-[10px] text-slate-400">
                        ({m.level === "City" ? "City" : "Municipality"})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400">
                        {m.population.toLocaleString()} pop
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          m.needScore >= 50
                            ? "bg-red-500/20 text-red-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {m.needScore}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-xs text-slate-400 text-center">
                  No Laguna municipalities match &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Recenter Button */}
        <button
          onClick={onRecenter}
          title="Fit Laguna Province"
          className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-500 px-3 py-2 rounded-xl shadow-xl text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">Recenter Laguna</span>
        </button>

        {/* Toggle: Optimization Panel */}
        <button
          onClick={onToggleOptimization}
          className={`px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            optimizationOpen
              ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30"
              : "bg-slate-900/95 backdrop-blur-md text-slate-200 border-slate-700/80 hover:border-emerald-500/60"
          }`}
        >
          <SlidersHorizontal size={15} />
          <span>Clinic Optimization</span>
        </button>

        {/* Toggle: Simulation Mode */}
        <button
          onClick={onToggleSimulation}
          className={`px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            simulationMode
              ? "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-500/40 animate-pulse"
              : "bg-slate-900/95 backdrop-blur-md text-slate-200 border-slate-700/80 hover:border-amber-500/60"
          }`}
        >
          <CloudRain size={15} />
          <span>Simulation Mode</span>
          <span
            className={`w-2 h-2 rounded-full ${
              simulationMode ? "bg-white" : "bg-slate-500"
            }`}
          />
        </button>

        {/* Toggle: AI Chatbot Assistant */}
        <button
          onClick={onToggleChatbot}
          className={`px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            chatbotOpen
              ? "bg-sky-600 text-white border-sky-500 ring-2 ring-sky-500/30"
              : "bg-slate-900/95 backdrop-blur-md text-slate-200 border-slate-700/80 hover:border-sky-500/60"
          }`}
        >
          <Bot size={15} />
          <span>AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
