import React, { useState } from 'react';
import { ArrowRight, Search, Bell, User, TrendingUp, TrendingDown, ChevronRight, Layers, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { useBrokerage } from '../context/BrokerageContext';

const heroBannerImg = '/images/hero-banner.jpg';

interface HeroProps {
  onStartInvesting: () => void;
  onSelectInstrumentSymbol?: (symbol: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartInvesting, onSelectInstrumentSymbol }) => {
  const { instruments } = useBrokerage();
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const currentAsset = instruments.find(i => i.symbol === selectedSymbol) || instruments[0];
  const activeInstruments = instruments.slice(0, 5);
  return (
    <section 
      id="hero"
      className="relative w-full bg-[#15170f] text-white overflow-hidden border-b border-white/5"
    >
      <div className="relative w-full min-h-[640px] lg:min-h-[720px] flex items-center">
        
        {/* Background Layer: Real Editorial Photo of iPhone on Dark Green Marble Table with Espresso Cup */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <picture>
            <img 
              src={heroBannerImg}
              alt="TradeShark Mobile on Marble Cafe Table" 
              className="w-full h-full object-cover object-right lg:object-[80%_center] filter brightness-[0.95]"
              referrerPolicy="no-referrer"
            />
          </picture>

          {/* Scrim Gradients matching eToro: Deep slate olive-black fading from left to preserve readability */}
          <div className="pointer-events-none absolute inset-0 z-[1] hidden lg:block bg-gradient-to-r from-[#15170f] via-[#15170f]/95 via-35% to-transparent to-75%" />
          <div className="pointer-events-none absolute inset-0 z-[1] hidden md:block lg:hidden bg-gradient-to-r from-[#15170f] via-[#15170f]/90 to-transparent" />
          <div className="pointer-events-none absolute inset-0 z-[1] md:hidden bg-gradient-to-b from-[#15170f] via-[#15170f]/90 via-50% to-[#15170f]" />
        </div>

        {/* Foreground Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Hero Text & Call to Actions */}
            <div className="lg:col-span-6 space-y-6 max-w-xl text-left">
              
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-[#d4d6cf] backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-[#6dff8a] animate-pulse" />
                <span>TradeShark Ltd • The Intelligence Platform</span>
              </div>

              {/* Exact eToro Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-bold tracking-tight text-[#f4f4f0] leading-[1.08]">
                A window into what other investors are doing<span className="text-[#6dff8a]">.</span>
              </h1>

              {/* Subheading */}
              <p className="text-lg sm:text-xl font-medium text-[#d4d6cf] leading-relaxed">
                You're welcome.
              </p>

              <p className="text-sm sm:text-base text-[#a3a89e] leading-relaxed">
                The data, tools, and collective intelligence you need for better investing. Trade stocks, crypto, and ETFs commission-free on one seamless screen.
              </p>

              {/* CTA Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  id="hero-cta-btn"
                  onClick={onStartInvesting}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 text-base sm:text-lg font-bold text-[#15170f] bg-[#6dff8a] hover:bg-[#5ce077] rounded-full shadow-[0_0_30px_rgba(109,255,138,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start investing</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <a
                  href="#copytrader"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 text-sm sm:text-base font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-full backdrop-blur-md transition-colors"
                >
                  <span>Explore CopyTrader™</span>
                </a>
              </div>

              {/* Quick Trust Highlights */}
              <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-white font-heading">$1</div>
                  <div className="text-xs text-[#a3a89e]">Stock commission</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#6dff8a] font-heading">0%</div>
                  <div className="text-xs text-[#a3a89e]">Commission on ETFs</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-white font-heading">24/7</div>
                  <div className="text-xs text-[#a3a89e]">Crypto markets</div>
                </div>
              </div>

            </div>

            {/* Right Column: Institutional Prime Trading Terminal */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="w-full max-w-[440px] rounded-3xl bg-[#12150e]/95 border border-white/15 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl text-left space-y-4">
                
                {/* Terminal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6dff8a] animate-pulse" />
                    <span className="text-xs font-mono font-bold text-white tracking-wider uppercase">Direct Market Access</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#6dff8a] bg-[#6dff8a]/10 px-2 py-0.5 rounded-full font-semibold">
                    12ms Latency
                  </span>
                </div>

                {/* Live Watchlist Strip */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/50 px-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Prime Liquid Instruments</span>
                    <a href="/markets" className="text-[#6dff8a] hover:underline font-semibold text-[11px]">
                      View All 5,000+ &rarr;
                    </a>
                  </div>

                  <div className="space-y-1.5">
                    {activeInstruments.map((item) => (
                      <div
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${
                          selectedSymbol === item.symbol
                            ? 'bg-white/10 border border-[#6dff8a]/60 shadow-lg'
                            : 'bg-white/[0.02] hover:bg-white/5 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow"
                            style={{ backgroundColor: item.avatarBg }}
                          >
                            {item.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{item.symbol}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-white/10 text-white/60 font-mono">
                                {item.category}
                              </span>
                            </div>
                            <div className="text-[10px] text-white/50 truncate max-w-[120px]">{item.name}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-white font-mono">
                            ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${item.deltaPercent >= 0 ? 'text-[#6dff8a]' : 'text-[#ff5c5c]'}`}>
                            {item.deltaPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{item.deltaPercent >= 0 ? '+' : ''}{item.deltaPercent.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Asset Quick Execution Desk */}
                {currentAsset && (
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase font-mono block">Selected Execution Asset</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold text-white">{currentAsset.symbol}</span>
                          <span className="text-xs text-white/60">/ USD</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-white/40 uppercase font-mono block">Real-time Spot</span>
                        <span className="text-lg font-bold text-[#6dff8a] font-mono">
                          ${currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Order Execution Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          if (onSelectInstrumentSymbol) onSelectInstrumentSymbol(currentAsset.symbol);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-[#6dff8a] hover:bg-[#5ce077] text-[#15170f] font-bold text-xs shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>BUY (Long)</span>
                      </button>

                      <button
                        onClick={() => {
                          if (onSelectInstrumentSymbol) onSelectInstrumentSymbol(currentAsset.symbol);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        <TrendingDown className="w-3.5 h-3.5 text-[#ff5c5c]" />
                        <span>SELL (Short)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Quick Links */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <a
                    href="/markets"
                    className="flex items-center gap-1 text-[#6dff8a] hover:underline font-semibold"
                  >
                    <span>Explore Markets Screener</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/popular-investors"
                    className="flex items-center gap-1 text-white/70 hover:text-white transition-colors"
                  >
                    <span>CopyTrader™ Desk</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6dff8a]" />
                  </a>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
