import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Image as ImageIcon, Play, Settings2, 
  Download, RefreshCw, Zap, ChevronRight, 
  User, Sparkles, SlidersHorizontal, ImagePlus,
  Check, X, Pause, FileVideo, Wand2, History
} from 'lucide-react';

const SETTINGS_OPTIONS = {
  model: [
    { id: 'slate-pro', name: 'Slate Pro 2.0', desc: 'High fidelity motion' },
    { id: 'slate-fast', name: 'Slate Fast 1.5', desc: 'Rapid prototyping' },
    { id: 'slate-anime', name: 'Slate Anime', desc: 'Stylized animation' }
  ],
  aspect: ['16:9', '9:16', '1:1', '21:9', '4:3'],
  duration: ['5s', '8s', '10s', '15s'],
  resolution: ['720p', '1080p', '1440p', '4K'],
  motion: ['Auto', 'Subtle', 'Dynamic', 'High Action']
};

export default function App() {
  // Global App State
  const [status, setStatus] = useState('idle'); // idle | generating | success
  const [activeTab, setActiveTab] = useState('create');
  const [navActive, setNavActive] = useState('workspace');
  
  // Composer State
  const [mediaFile, setMediaFile] = useState(null);
  const [prompt, setPrompt] = useState('A highly detailed cinematic shot of a red sports car driving through neon-lit Tokyo streets at midnight, rain reflections on the asphalt, 8k resolution, photorealistic.');
  const [settings, setSettings] = useState({
    model: SETTINGS_OPTIONS.model[0],
    aspect: '16:9',
    duration: '5s',
    resolution: '1080p',
    motion: 'Auto'
  });
  
  // UI Interaction State
  const [openDropdown, setOpenDropdown] = useState(null);
  const [toast, setToast] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Generation State
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState('');
  
  // Video Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  // Video playback simulation
  useEffect(() => {
    let interval;
    if (status === 'success' && isPlaying) {
      interval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 0.5;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [status, isPlaying]);

  const showToast = (message, duration = 3000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile({ name: file.name, type: file.type });
      showToast(`Attached: ${file.name}`);
    }
  };

  const handleEnhance = () => {
    if (isEnhancing || status !== 'idle') return;
    setIsEnhancing(true);
    showToast("AI is enhancing your prompt...");
    
    setTimeout(() => {
      setPrompt(prev => {
        const enhanced = prev.trim() + " Cinematic lighting, volumetric fog, shot on 35mm lens, Unreal Engine 5 render, award winning photography, ultra-detailed.";
        return enhanced;
      });
      setIsEnhancing(false);
      showToast("Prompt enhanced successfully.");
    }, 1500);
  };

  const handleGenerate = () => {
    if (!prompt.trim() && !mediaFile) {
      showToast("Please add a prompt or upload media first.");
      return;
    }
    
    setStatus('generating');
    setProgress(0);
    setVideoProgress(0);
    setIsPlaying(true);
    
    const steps = [
      { t: 'Allocating A100 cluster...', p: 10 },
      { t: 'Encoding prompt semantics...', p: 25 },
      { t: 'Generating base keyframes...', p: 45 },
      { t: 'Applying temporal consistency...', p: 65 },
      { t: 'Upscaling and refining...', p: 85 },
      { t: 'Finalizing video asset...', p: 98 }
    ];

    setLoadingStep(steps[0].t);
    let currentP = 0;
    let stepIdx = 0;

    const interval = setInterval(() => {
      currentP += Math.random() * 2;
      
      if (currentP >= steps[stepIdx]?.p && stepIdx < steps.length - 1) {
        stepIdx++;
        setLoadingStep(steps[stepIdx].t);
      }

      if (currentP >= 100) {
        currentP = 100;
        clearInterval(interval);
        setTimeout(() => {
          setStatus('success');
          showToast("Generation complete.");
        }, 400);
      }
      setProgress(Math.floor(currentP));
    }, 50);
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setVideoProgress(Math.max(0, Math.min(100, percentage)));
  };

  const TopNav = () => (
    <header className="flex items-center justify-between px-6 h-14 bg-zinc-950 border-b border-zinc-800/80 text-zinc-100 shrink-0 select-none z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 font-bold tracking-widest text-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => showToast("Navigating Home")}>
          <div className="w-6 h-6 bg-zinc-100 rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 bg-zinc-950 rounded-full"></div>
          </div>
          SLATE
        </div>
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium text-zinc-400">
          {['Workspace', 'Explore', 'Assets', 'API'].map(item => (
            <button 
              key={item}
              onClick={() => { setNavActive(item.toLowerCase()); showToast(`Loading ${item}...`); }}
              className={`px-3 py-1.5 rounded-md transition-all ${navActive === item.toLowerCase() ? 'bg-zinc-800/80 text-white' : 'hover:text-zinc-100 hover:bg-zinc-900/50'}`}
            >
              {item}
              {item === 'API' && <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded ml-2 uppercase tracking-wider">New</span>}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <button onClick={() => showToast("Opening History...")} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-2 hidden sm:flex">
          <History size={16} /> History
        </button>
        <div 
          className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 cursor-pointer hover:border-zinc-600 transition-colors"
          onClick={() => showToast("Opening Billing...")}
        >
          <Zap size={14} className="text-amber-400" />
          <span className="font-medium text-zinc-200">1,240</span>
        </div>
        <button 
          onClick={() => showToast("Opening Profile...")}
          className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors border border-zinc-700"
        >
          <User size={16} />
        </button>
      </div>
    </header>
  );

  const DropdownSelector = ({ label, value, options, objectKey, settingKey }) => {
    const isOpen = openDropdown === settingKey;
    
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button 
          disabled={status !== 'idle'}
          onClick={() => setOpenDropdown(isOpen ? null : settingKey)}
          className={`w-full bg-zinc-900/80 border hover:bg-zinc-900 rounded-lg p-2.5 text-sm flex justify-between items-center text-zinc-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? 'border-zinc-500 shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'border-zinc-800 hover:border-zinc-600'}`}
        >
          <span className="text-zinc-500">{label}</span>
          <span className="font-medium flex items-center gap-1 text-white">
            {value}
          </span>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {options.map((opt) => (
              <button
                key={typeof opt === 'string' ? opt : opt.id}
                onClick={() => {
                  setSettings(s => ({ ...s, [settingKey]: opt }));
                  setOpenDropdown(null);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between ${
                  (typeof opt === 'string' ? value === opt : value === opt.name) ? 'bg-zinc-800/50 text-white font-medium' : 'text-zinc-400'
                }`}
              >
                {typeof opt === 'string' ? opt : (
                  <div>
                    <div className="text-zinc-200">{opt.name}</div>
                    <div className="text-xs text-zinc-500 font-normal">{opt.desc}</div>
                  </div>
                )}
                {(typeof opt === 'string' ? value === opt : value === opt.name) && <Check size={14} className="text-zinc-300" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Sidebar = () => (
    <aside className="w-full md:w-[340px] flex flex-col bg-zinc-950 border-r border-zinc-800/80 h-full shrink-0 relative z-30">
      <div className="flex px-4 pt-4 pb-2 gap-6 text-sm font-medium border-b border-zinc-800/50">
        {['Create', 'Edit', 'Motion'].map(tab => (
          <button 
            key={tab}
            onClick={() => {
              if(status === 'idle') setActiveTab(tab.toLowerCase());
              else showToast("Cannot change mode while generating.");
            }}
            className={`pb-2 px-1 relative transition-colors ${activeTab === tab.toLowerCase() ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab}
            {activeTab === tab.toLowerCase() && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-6 p-4 pb-24">
        
        {/* Upload Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Input Media</span>
            {mediaFile && <button onClick={() => setMediaFile(null)} className="text-zinc-400 hover:text-red-400 uppercase text-[10px]">Clear</button>}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={status !== 'idle'}
            className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden ${
              mediaFile ? 'border-zinc-700 bg-zinc-900/80' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/30 hover:bg-zinc-900/60'
            }`}
          >
            {mediaFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  {mediaFile.type?.includes('video') ? <FileVideo size={18} className="text-zinc-200" /> : <ImageIcon size={18} className="text-zinc-200" />}
                </div>
                <div className="text-sm font-medium text-zinc-300 max-w-[200px] truncate px-4">{mediaFile.name}</div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                    <ImageIcon size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                    <Video size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                  </div>
                </div>
                <div className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300">
                  Upload Image or Video
                </div>
              </>
            )}
          </button>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Prompt</span>
            <button 
              onClick={handleEnhance}
              disabled={status !== 'idle' || isEnhancing}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50 group"
            >
              <Wand2 size={12} className={isEnhancing ? 'animate-spin' : 'group-hover:text-amber-300'} /> 
              {isEnhancing ? 'Enhancing...' : 'Enhance'}
            </button>
          </div>
          <div className="relative group">
            <textarea 
              disabled={status !== 'idle'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your scene in detail... e.g. A cinematic tracking shot of a neon city in the rain."
              className="w-full h-32 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 focus:ring-1 focus:ring-zinc-500 resize-none disabled:opacity-50 transition-all leading-relaxed"
            />
          </div>
        </div>

        {/* Settings Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
            <span>Parameters</span>
            <button onClick={() => showToast("Advanced settings locked.")} className="text-zinc-400 hover:text-zinc-200 transition-colors">Advanced</button>
          </div>
          
          <DropdownSelector label="Model" value={settings.model.name} options={SETTINGS_OPTIONS.model} settingKey="model" />

          <div className="grid grid-cols-2 gap-2 relative">
            <DropdownSelector label="Aspect" value={settings.aspect} options={SETTINGS_OPTIONS.aspect} settingKey="aspect" />
            <DropdownSelector label="Duration" value={settings.duration} options={SETTINGS_OPTIONS.duration} settingKey="duration" />
            <DropdownSelector label="Res" value={settings.resolution} options={SETTINGS_OPTIONS.resolution} settingKey="resolution" />
            <DropdownSelector label="Motion" value={settings.motion} options={SETTINGS_OPTIONS.motion} settingKey="motion" />
          </div>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent pt-8">
        <button 
          onClick={handleGenerate}
          disabled={status !== 'idle' || (!prompt && !mediaFile)}
          className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-[0.98]"
        >
          {status === 'generating' ? (
            <>
              <RefreshCw size={18} className="animate-spin text-zinc-500" />
              <span className="text-zinc-500">Generating Asset...</span>
            </>
          ) : status === 'success' ? (
            <>
              <Check size={18} />
              Generation Complete
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Generate Video
              <span className="ml-1.5 text-zinc-600 font-normal text-sm flex items-center bg-black/10 px-1.5 rounded">
                <Zap size={10} className="inline mr-1" /> 15
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );

  const Workspace = () => (
    <section className="flex-1 relative bg-zinc-950 flex flex-col overflow-y-auto">
      {/* Subtle Studio Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      
      <div className="relative z-10 w-full h-full flex flex-col">
        
        {/* VIEW: IDLE */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto h-full px-6 animate-in fade-in duration-500 zoom-in-95">
            <div className="text-center mb-16">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 drop-shadow-xl">MAKE VIDEOS IN ONE CLICK</h1>
              <p className="text-zinc-400 text-lg font-medium">Professional camera control, framing, and high-quality VFX.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {[
                { i: <ImagePlus size={28}/>, t: "ADD MEDIA", d: "Upload a starting image or video.", action: () => fileInputRef.current?.click() },
                { i: <SlidersHorizontal size={28}/>, t: "SET PARAMS", d: "Choose aspect, style, and motion.", action: () => showToast("Adjust settings in the sidebar.") },
                { i: <Play size={28} className="ml-1"/>, t: "GENERATE", d: "Render your cinematic masterpiece.", action: handleGenerate }
              ].map((card, idx) => (
                <div key={idx} onClick={card.action} className="group cursor-pointer">
                  <div className={`aspect-[4/3] bg-zinc-900/50 border border-zinc-800/80 group-hover:border-zinc-600 group-hover:bg-zinc-900 rounded-2xl mb-5 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden ${idx === 2 ? 'group-hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-lg ${idx === 2 ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
                      {card.i}
                    </div>
                  </div>
                  <h3 className="font-bold text-zinc-100 mb-1.5 uppercase tracking-wider text-sm">{card.t}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{card.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: GENERATING */}
        {status === 'generating' && (
          <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto px-6 animate-in fade-in duration-300">
            <div className="w-full aspect-video bg-zinc-900/80 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-tr from-zinc-800/20 via-transparent to-zinc-800/20 animate-pulse duration-1000"></div>
              
              <div className="z-10 flex flex-col items-center gap-8">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" className="stroke-zinc-800" strokeWidth="4" />
                    <circle 
                      cx="50" cy="50" r="46" fill="none" className="stroke-zinc-100 transition-all duration-300 ease-out" 
                      strokeWidth="4" strokeLinecap="round" strokeDasharray="289" strokeDashoffset={289 - (289 * progress) / 100} 
                    />
                  </svg>
                  <Sparkles size={28} className="text-white animate-pulse" />
                </div>
                
                <div className="text-center space-y-3">
                  <div className="text-4xl font-bold text-white tracking-tighter drop-shadow-md">{progress}%</div>
                  <div className="text-sm text-zinc-400 font-mono tracking-tight bg-zinc-950/50 px-4 py-1.5 rounded-full border border-zinc-800 inline-block shadow-inner">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                    {loadingStep}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SUCCESS */}
        {status === 'success' && (
          <div className="flex flex-col w-full h-full max-w-6xl mx-auto p-6 pt-10 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <div className="flex justify-between items-end mb-6">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Generation Complete</h2>
                <p className="text-zinc-400 text-sm truncate bg-zinc-900/50 inline-block px-3 py-1 rounded-md border border-zinc-800/50">
                  <span className="text-zinc-500 mr-2">Prompt:</span>
                  {prompt || "No prompt provided"}
                </p>
                <div className="flex gap-4 mt-3 text-xs font-mono text-zinc-500">
                  <span className="flex items-center gap-1"><Settings2 size={12}/> {settings.model.name}</span>
                  <span>•</span>
                  <span>{settings.resolution}</span>
                  <span>•</span>
                  <span>{settings.duration}</span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button 
                  onClick={() => { setStatus('idle'); setPrompt(''); setMediaFile(null); }}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 hover:border-zinc-500 transition-all flex items-center gap-2 active:scale-95"
                >
                  <RefreshCw size={14} /> Start Over
                </button>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 hover:border-zinc-500 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Settings2 size={14} /> Remix Settings
                </button>
                <button 
                  onClick={() => showToast("Downloading asset to your device...")}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
                >
                  <Download size={14} /> Download File
                </button>
              </div>
            </div>

            <div className="w-full flex-1 min-h-[400px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)] group">
              {/* Fake Video Content */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-[10000ms] ease-linear" style={{ transform: isPlaying ? 'scale(1.05)' : 'scale(1)' }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
              
              {/* Center Play Button Overlay (Visible when paused) */}
              {!isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all animate-in fade-in duration-200" onClick={() => setIsPlaying(true)}>
                  <button className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center pl-1 hover:bg-white hover:text-black hover:scale-110 transition-all shadow-2xl">
                    <Play size={36} className="fill-current" />
                  </button>
                </div>
              )}

              {/* Video Timeline & Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent flex items-center gap-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} 
                  className="text-white hover:text-zinc-300 transition-colors focus:outline-none w-8 flex justify-center"
                >
                  {isPlaying ? <Pause size={24} className="fill-current"/> : <Play size={24} className="fill-current"/>}
                </button>
                
                <div 
                  className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer relative group/timeline"
                  onClick={handleTimelineClick}
                >
                  {/* Hover preview scrub bar */}
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/timeline:opacity-100 transition-opacity"></div>
                  
                  {/* Actual Progress */}
                  <div 
                    className="h-full bg-zinc-100 rounded-full transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ width: `${videoProgress}%` }}
                  ></div>
                </div>
                
                <div className="text-zinc-300 text-sm font-mono tracking-wider w-28 text-right select-none">
                  00:{(videoProgress * 0.05).toFixed(0).padStart(2, '0')} / 00:05
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden relative">
      <TopNav />
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <Sidebar />
        <Workspace />
      </main>

      {/* Global Toast Notification */}
      <div className={`fixed bottom-6 right-6 bg-zinc-900 border border-zinc-700 text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-[100] transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <p className="text-sm font-medium">{toast}</p>
        <button onClick={() => setToast(null)} className="ml-4 text-zinc-500 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}