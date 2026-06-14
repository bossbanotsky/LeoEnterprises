import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  HardHat, 
  Truck, 
  ArrowRight,
  Phone,
  Mail,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Users,
  Award,
  ZapIcon,
  Recycle,
  Sparkles,
  TrendingUp,
  Gem,
  Coins
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Category } from '../services/galleryService';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

const services = [
  {
    slug: "trading",
    title: "Scrap & Metal Trading",
    icon: Recycle,
    description: "L & P Scrap Trading / Junkshop: We buy all kinds of scrap materials! From steel, copper, aluminum, industrial battery scraps to paper, plastics, and old heavy machinery at the best rates in Batangas.",
    category: "Scrap Trading" as any,
    color: "amber",
    image: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "civil-works",
    title: "Civil Works & Construction Support",
    icon: HardHat,
    description: "Robust civil works solutions for industrial facilities. Our expert team handles professional concrete works, site preparations, steel framing, structures, and land developments.",
    category: "Civil Works" as Category,
    color: "amber",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "hauling",
    title: "All Kinds of Hauling Services",
    icon: Truck,
    description: "L & P Hauling: End-to-end hauling services for heavy materials, debris clearing, and industrial transport. Powered by high-capacity bulk dump trucks and a certified operations team.",
    category: "Hauling Services" as Category,
    color: "amber",
    image: "https://images.unsplash.com/photo-1580674684081-7619685050b8?auto=format&fit=crop&q=80&w=1200"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden selection:bg-amber-600 selection:text-white relative font-sans text-foreground">
      <PWAInstallPrompt />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/60 backdrop-blur-xl border-b border-amber-600/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center group cursor-pointer min-w-0 flex-1 sm:flex-initial">
            <span className="font-extrabold tracking-tighter leading-none group-hover:opacity-90 transition-opacity flex flex-col xs:flex-row xs:items-baseline gap-y-0.5 xs:gap-x-2">
              <span className="text-foreground text-xl xs:text-2xl sm:text-3xl uppercase font-black tracking-normal">
                L & P
              </span>
              <span className="text-amber-600 text-[11px] xs:text-lg sm:text-xl font-black italic underline decoration-amber-600/20 underline-offset-2 uppercase whitespace-nowrap">
                TRADING AND SERVICES
              </span>
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold text-stone-600 tracking-widest uppercase">
            <a href="#services" className="hover:text-amber-600 transition-all duration-300 py-1">Services</a>
            <a href="#about" className="hover:text-amber-600 transition-all duration-300 py-1">About</a>
            <a href="#riches" className="hover:text-amber-600 transition-all duration-300 py-1">Our Journey</a>
            <a href="#contact" className="hover:text-amber-600 transition-all duration-300 py-1">Contact</a>
          </div>

          <div className="flex items-center shrink-0">
            <Link to="/login">
              <Button 
                className="rounded-full bg-amber-600 text-white hover:bg-amber-700 text-[10px] sm:text-[12px] font-bold px-5 py-3 sm:px-8 sm:py-5 transition-all duration-300 active:scale-95 uppercase tracking-widest shadow-[0_8px_20px_rgba(217,119,6,0.15)]"
              >
                Secure Access
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - The progression story begins */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-12 overflow-hidden">
        {/* Abstract Floating Success Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] left-[5%] w-[40vw] h-[40vw] bg-amber-500/10 rounded-full blur-[120px] animate-[pulse_8s_infinite]" />
          <div className="absolute bottom-[10%] right-[5%] w-[45vw] h-[45vw] bg-emerald-500/5 rounded-full blur-[140px] animate-[pulse_10s_infinite_2s]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-600/10 bg-amber-50/60 backdrop-blur-md mb-8">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-amber-800">Operational Excellence & Upward Growth</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-[90px] font-black tracking-tight leading-[1] mb-8 text-foreground">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-900 via-amber-700 to-amber-600">Trading and</span> <br /> 
            <span className="font-light italic text-stone-700">Industrial Prosperity.</span> 
          </h1>
          
          <p className="text-base sm:text-xl md:text-2xl text-stone-600 max-w-3xl mx-auto font-light leading-relaxed mb-12">
            L & P is Bauan's flagship industrial partner—buying all classes of scrap metals under a model of upward progress, while deploying elite civil support and hauling operations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#services" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-14 sm:h-16 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold px-10 transition-all duration-300 uppercase tracking-widest">
                Explore Services
              </Button>
            </a>
            <a href="#riches" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-14 sm:h-16 rounded-full bg-slate-900/80 hover:bg-slate-800 text-foreground border border-stone-200/20 text-xs sm:text-sm font-bold px-10 transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-2">
                Our Rags-to-Riches Story
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </Button>
            </a>
          </div>
        </motion.div>
      </section>

      {/* Services Grid Section */}
      <section id="services" className="relative py-24 sm:py-32 scroll-mt-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mb-3 block">Elevating Operations</span>
            <h3 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-[1.1] mb-4">Core Competency</h3>
            <p className="text-base sm:text-lg text-stone-600 leading-relaxed font-light">
              We leverage premium heavy machinery and safe engineering capabilities to deliver secure solutions for key industrial clients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => (
              <Link
                to={`/services/${service.slug}`}
                key={service.title}
                className="group relative rounded-[32px] bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-amber-600/30 transition-all duration-500 flex flex-col h-[460px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(217,119,6,0.08)]"
              >
                <div className="h-[200px] w-full shrink-0 relative overflow-hidden bg-stone-100 dark:bg-slate-800">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out opacity-95"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-slate-900/90 backdrop-blur-md flex items-center justify-center border border-amber-600/10 group-hover:bg-amber-600 transition-colors duration-300">
                    <service.icon className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col p-8 pt-2">
                  <h4 className="text-lg font-black text-foreground mb-2.5 tracking-tight group-hover:text-amber-600 transition-colors">{service.title}</h4>
                  <p className="text-stone-600 leading-relaxed text-xs sm:text-sm mb-auto font-light">
                    {service.description}
                  </p>
                  
                  <div className="pt-5 border-t border-stone-100 flex items-center justify-between mt-4">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">
                      Learn Service Path
                    </span>
                    <div className="w-9 h-9 rounded-full bg-stone-55 hover:bg-amber-50 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Rags to Riches Symbolic Progression Timeline */}
      <section id="riches" className="py-24 sm:py-32 bg-amber-50/20 dark:bg-slate-900/20 relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mb-3 block">Inspirational Landmark</span>
            <h3 className="text-4xl font-extrabold text-foreground tracking-tight mb-4">Our Rags to Riches Story</h3>
            <p className="text-stone-600 font-light text-base sm:text-lg">
              Understanding the path L & P took from a humble single-person manual scrap collection workspace to a multi-truck premier regional industrial service partner.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Progression Line overlay */}
            <div className="hidden lg:block absolute top-[25%] left-8 right-8 h-0.5 bg-gradient-to-r from-stone-400/20 via-amber-400/40 to-emerald-500/20 -z-10" />

            {[
              { 
                level: "Stage 01",
                milestone: "Humble Scrap Origins",
                desc: "Started in Batangas with a tiny manual cart collecting street-level metal residues with raw focus.",
                icon: Recycle,
                theme: "border-stone-200 bg-stone-50 text-stone-600"
              },
              { 
                level: "Stage 02",
                milestone: "Dedicated Ground Work",
                desc: "Established active physical relationships with local Batangas merchants and got certified operations clearance.",
                icon: HardHat,
                theme: "border-amber-200 bg-amber-50/50 text-amber-700"
              },
              { 
                level: "Stage 03",
                milestone: "Capital Expansion",
                desc: "Purchased high-capacity bulk dump trucks to implement fast heavy-duty industrial hauling.",
                icon: Truck,
                theme: "border-amber-300 bg-amber-100/30 text-amber-800"
              },
              { 
                level: "Stage 04",
                milestone: "Prospective Prosperity",
                desc: "Expanded into high-command ERP systems, serving premier industrial clients as Bauan's trusted support core.",
                icon: Gem,
                theme: "border-emerald-300 bg-emerald-50 text-emerald-700"
              }
            ].map((step, idx) => (
              <div 
                key={idx}
                className={`p-6 rounded-3xl border ${step.theme} shadow-sm backdrop-blur-md flex flex-col justify-between h-[250px] hover:-translate-y-1.5 transition-transform duration-300 relative`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{step.level}</span>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-foreground text-sm whitespace-nowrap mb-2">{step.milestone}</h4>
                  <p className="text-stone-600 text-[11px] leading-relaxed font-light">{step.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-amber-700 uppercase mt-4">
                  <span>Ascension Completed</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 sm:py-32 bg-transparent relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mb-3 block">Corporate Profile</span>
              <h3 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1] mb-6 text-foreground">
                Pioneering regional <br /> <span className="text-amber-600 italic">service integrity.</span>
              </h3>
              <p className="text-stone-600 text-sm sm:text-base font-light leading-relaxed mb-8">
                Based in Bauan, Batangas, L & P Trading and Services commands expert technical service deployments. By integrating modern software controls, we maintain 100% precision in employee metrics, client deliverables, and safety standards.
              </p>
              
              <div className="grid grid-cols-2 gap-8 border-t border-stone-200/60 pt-8">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-foreground mb-1">12+</div>
                  <div className="text-[9px] text-stone-500 font-bold uppercase tracking-[0.2em]">Years of Operations</div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-foreground mb-1">800+</div>
                  <div className="text-[9px] text-stone-500 font-bold uppercase tracking-[0.2em]">Projects Engineered</div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-video sm:aspect-square bg-slate-900/40 rounded-[32px] overflow-hidden border border-stone-700/60 shadow-lg p-2.5">
                <img 
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=2070" 
                  alt="Batangas industrial site" 
                  className="w-full h-full rounded-[24px] object-cover opacity-80"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
              
              <div className="absolute -bottom-6 -left-6 bg-slate-900/90 backdrop-blur-xl border border-amber-600/10 p-5 rounded-2xl shadow-xl hidden md:block max-w-[250px]">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-foreground">Elite Labor Team</span>
                </div>
                <p className="text-stone-600 text-[11px] leading-relaxed">
                  Over 100+ highly trained local specialists certified in hauling logistics and steelworks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Direct Professional Contact */}
      <section id="contact" className="py-24 sm:py-32 bg-transparent relative overflow-hidden scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mb-3 block">Partner with Success</span>
          <h3 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight mb-6">
            Let's build industrial <br /> <span className="text-amber-600 italic">milestones together.</span>
          </h3>
          <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed mb-10 max-w-2xl">
            Want to arrange high-value metal trading or acquire reliable support hauling? Initiate a professional dialogue with our operations management teams directly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
            <a href="tel:09946064463" className="w-full sm:w-auto">
              <div className="flex items-center gap-4 bg-slate-800/40 border border-stone-700/60 p-4 pr-8 rounded-full hover:border-amber-600/20 hover:scale-[1.02] transition-all duration-300 text-left">
                <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block leading-none mb-1">Direct Line</span>
                  <span className="text-base font-extrabold text-foreground">0994-606-4463</span>
                </div>
              </div>
            </a>
            
            <a href="mailto:info@lptradingandservices.com" className="w-full sm:w-auto">
              <div className="flex items-center gap-4 bg-slate-800/40 border border-stone-700/60 p-4 pr-8 rounded-full hover:border-amber-600/20 hover:scale-[1.02] transition-all duration-300 text-left">
                <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block leading-none mb-1">Official Email</span>
                  <span className="text-sm font-extrabold text-foreground">info@lptradingandservices.com</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-[#1c1917] py-16 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-lg tracking-wider">L & P</span>
              </div>
              <p className="text-stone-400 text-xs font-light leading-relaxed max-w-[220px]">
                Bauan's premier multi-service industrial engine delivering excellence.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <h4 className="text-amber-500 font-bold uppercase tracking-widest text-[9px] mb-1">Explore</h4>
              <a href="#services" className="text-stone-400 hover:text-white text-xs transition-colors">Services</a>
              <a href="#about" className="text-stone-400 hover:text-white text-xs transition-colors">Integrity Profile</a>
              <a href="#contact" className="text-stone-400 hover:text-white text-xs transition-colors">Contact</a>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-amber-500 font-bold uppercase tracking-widest text-[9px] mb-1">Secured Portals</h4>
              <Link to="/login" className="text-stone-400 hover:text-white text-xs transition-colors">Staff Terminal</Link>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-amber-500 font-bold uppercase tracking-widest text-[9px] mb-1">Development Framework</h4>
              <p className="text-stone-400 text-xs font-light leading-relaxed">
                Optimized lightweight SPA architecture with secure Firestore telemetry.
              </p>
            </div>
          </div>
          
          <div className="w-full h-px bg-stone-800 mb-8" />
          
          <div className="text-center">
            <p className="text-stone-500 text-[10px] font-semibold uppercase tracking-widest">
              © 2026 L & P TRADING AND SERVICES. DEPLOYED IN COMPLIANCE WITH PWA CORE STANDARDS.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
