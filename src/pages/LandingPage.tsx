import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  HardHat, 
  Wrench, 
  Truck, 
  Hammer, 
  Cpu, 
  Camera, 
  ArrowRight,
  Phone,
  MapPin,
  Mail,
  ShieldCheck,
  Zap,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  Users,
  Award,
  ZapIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Category } from '../services/galleryService';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

const services = [
  {
    slug: "hauling",
    title: "Hauling & Logistics",
    icon: Truck,
    description: "Industry-leading heavy-duty hauling and logistics solutions optimized for reliability and safety.",
    category: "Hauling Services" as Category,
    color: "blue",
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "civil-works",
    title: "Civil Works & Construction",
    icon: HardHat,
    description: "Comprehensive construction support from structural foundations to project finishing.",
    category: "Civil Works" as Category,
    color: "orange",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "fabrication",
    title: "Fabrication & Metal Works",
    icon: Hammer,
    description: "Precision metal fabrication and industrial repair services for custom technical needs.",
    category: "Fabrication" as Category,
    color: "slate",
    image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "maintenance",
    title: "Building Maintenance",
    icon: Wrench,
    description: "Electrical, plumbing, and general building maintenance services to ensure facility efficiency.",
    category: "Repairs & Maintenance" as Category,
    color: "indigo",
    image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "it-services",
    title: "IT Solutions & Networking",
    icon: Cpu,
    description: "Advanced computing infrastructure, secure networking, and enterprise software systems.",
    category: "IT Services" as Category,
    color: "teal",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "cctv",
    title: "CCTV & Security Systems",
    icon: Camera,
    description: "Integrated security protocols and multi-monitor surveillance rooms for 24/7 protection.",
    category: "CCTV Installation" as Category,
    color: "red",
    image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=1200"
  }
];


export default function LandingPage() {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden selection:bg-blue-500 selection:text-white relative font-sans text-slate-200">
      {/* Full Page Background Image - Rags to Riches / Progression Theme */}
      <div 
        className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2560')` }}
      />
      {/* Dark overlay for readability - much lighter in the center */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-[#050505]/70 via-[#050505]/20 to-[#050505]/80 backdrop-blur-[1px]" />
      
      <PWAInstallPrompt />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/40 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center group cursor-pointer whitespace-nowrap shrink">
              <span className="font-extrabold text-lg sm:text-2xl tracking-tighter leading-none group-hover:opacity-90 transition-opacity truncate">
                <span className="text-white">LEO</span> <span className="text-blue-500">ENTERPRISES</span>
              </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-[12px] font-bold text-white/60 tracking-widest uppercase">
            <a href="#services" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1">Services</a>
            <a href="#about" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1">About</a>
            <a href="#contact" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1">Contact</a>
          </div>

          <div className="flex items-center shrink-0">
            <Link to="/login">
              <Button 
                className="rounded-full bg-blue-600/20 backdrop-blur-md border border-blue-500/50 text-white hover:bg-blue-500 hover:border-transparent text-[10px] sm:text-[12px] font-bold px-5 py-3 sm:px-8 sm:py-5 transition-all duration-300 active:scale-95 uppercase tracking-widest shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
              >
                Secure Access
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/30 rounded-full blur-[150px] mix-blend-screen opacity-50 animate-[pulse_6s_ease-in-out_infinite]"></div>
          <div className="absolute bottom-[10%] right-[-10%] w-[60vw] h-[60vw] bg-sky-500/20 rounded-full blur-[180px] mix-blend-screen opacity-50 animate-[pulse_7s_ease-in-out_infinite] delay-1000"></div>
          <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen opacity-40 animate-[pulse_5s_ease-in-out_infinite] delay-2000"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-6xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-12">
             <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-xs font-medium tracking-widest uppercase text-slate-300">Operational Excellence</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl lg:text-[110px] font-semibold tracking-tight leading-[0.9] mb-10 text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-300">Industrial &</span> <br /> 
            <span className="font-light text-slate-300">Technical Solutions.</span> 
          </h1>
          
          <p className="text-lg md:text-2xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mb-16">
            From heavy-duty hauling to high-tech digital systems, we provide comprehensive services built for performance, reliability, and precision business growth.
          </p>

          <a href="#services" className="relative group inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-sky-400 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
            <Button className="relative h-16 sm:h-20 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-sm sm:text-lg font-semibold px-10 sm:px-16 transition-all duration-300 border border-white/20 uppercase tracking-widest overflow-hidden group">
              <span className="relative z-10 flex items-center gap-3">
                VIEW SERVICES
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </a>
        </motion.div>
      </section>


      {/* Services Grid Section */}
      <section id="services" className="relative py-32 lg:py-48 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-32 max-w-4xl mx-auto">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 block">Our Expertise</span>
            <h3 className="text-5xl lg:text-7xl font-semibold text-white tracking-tight leading-[1] mb-8">Multi-Industry <br /><span className="text-slate-400">Professional Services</span></h3>
            <p className="text-xl text-slate-400 leading-relaxed font-light">
              We leverage modern technology and heavy industry experience to deliver end-to-end solutions for high-demand business environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, idx) => (
              <Link
                to={`/services/${service.slug}`}
                key={service.title}
                className="group relative rounded-[32px] bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 hover:border-white/10 transition-all duration-500 flex flex-col h-[480px] overflow-hidden shadow-2xl"
              >
                <div className="h-[220px] w-full shrink-0 relative overflow-hidden">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s] ease-out opacity-90 group-hover:opacity-100"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
                  <div className="absolute top-6 left-6 w-12 h-12 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500">
                    <service.icon className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col px-8 pb-8 pt-4">
                  <h4 className="text-xl font-semibold text-white mb-3 tracking-tight pr-4 group-hover:text-blue-400 transition-colors">{service.title}</h4>
                  <p className="text-slate-400 leading-relaxed text-sm mb-auto font-light">
                    {service.description}
                  </p>
                  
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between group-hover:border-white/10 transition-colors mt-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] group-hover:text-white transition-colors flex items-center gap-2">
                      Explore Details
                    </span>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-slate-950 transition-all duration-300 border border-white/5 group-hover:border-transparent">
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="about" className="py-32 lg:py-56 bg-transparent text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/5 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-400/5 blur-[120px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 block">Our Identity</span>
              <h3 className="text-5xl lg:text-7xl font-semibold tracking-tight leading-[1] mb-8 text-white">
                Redefining <br /> <span className="text-slate-400">Service Excellence.</span>
              </h3>
              <p className="text-slate-400 text-lg font-light leading-relaxed mb-12 max-w-lg">
                Headquartered in Bauan, Batangas, Leo Enterprises delivers mission-critical technical services across the region. We combine elite operational safety with innovative problem-solving.
              </p>
              
              <div className="grid grid-cols-2 gap-12 border-t border-white/5 pt-12">
                <div>
                  <div className="text-4xl font-light text-white mb-3 tracking-tighter">12+</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Years of Operations</div>
                </div>
                <div>
                  <div className="text-4xl font-light text-white mb-3 tracking-tighter">800+</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Expert Projects</div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
               initial={{ opacity: 0, x: 50 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8 }}
               className="relative"
            >
              <div className="aspect-square bg-[#0a0a0a] rounded-[40px] overflow-hidden border border-white/5 shadow-2xl p-2 relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent pointer-events-none" />
                <div className="w-full h-full rounded-[32px] overflow-hidden relative group">
                  <img 
                    src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=2070" 
                    alt="Team work" 
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2000ms] grayscale group-hover:grayscale-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <ZapIcon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Stat Card */}
              <div className="absolute -bottom-8 -left-8 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 p-6 rounded-[24px] shadow-2xl hidden md:block max-w-[240px]">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/5">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm uppercase tracking-wider text-white">Elite Team</span>
                </div>
                <p className="text-slate-400 text-xs font-light tracking-wide leading-relaxed">
                  Powered by 100+ specialized technical personnel.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Why Choose Us */}
      <section className="py-32 lg:py-48 bg-transparent relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/5 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-400/5 blur-[120px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-24 relative z-10">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 block">Competitive Edge</span>
            <h3 className="text-5xl lg:text-7xl font-semibold text-white tracking-tight leading-[1]">Why the Industry <br /><span className="text-slate-400">Prefers LEO</span></h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: Zap, 
                title: "Fast Response", 
                desc: "Agile project deployment and 24/7 technical support accessibility.",
                image: "https://images.unsplash.com/photo-1590674867585-81c0534bfe71?auto=format&fit=crop&q=80&w=800"
              },
              { 
                icon: Award, 
                title: "Skilled Force", 
                desc: "Highly certified technical teams with years of specialized field experience.",
                image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=800"
              },
              { 
                icon: ShieldCheck, 
                title: "Reliable Gear", 
                desc: "State-of-the-art fleet and high-precision technical equipment.",
                image: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800"
              },
              { 
                icon: CheckCircle2, 
                title: "Local Trust", 
                desc: "A proven track record with Bauan's most critical industrial facilities.",
                image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group relative rounded-[32px] bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 hover:border-white/10 transition-all duration-500 flex flex-col h-[400px] overflow-hidden"
              >
                <div className="h-[180px] w-full shrink-0 relative overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s] ease-out opacity-80 group-hover:opacity-100"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                  <div className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500">
                    <item.icon className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                
                <div className="p-8 flex-1 flex flex-col pt-2">
                  <h4 className="text-xl font-semibold mb-3 tracking-tight text-white group-hover:text-blue-400 transition-colors uppercase text-xs tracking-[2px]">{item.title}</h4>
                  <p className="text-slate-400 text-sm font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-32 lg:py-56 bg-transparent relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 rotate-180"></div>
        <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-blue-400/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-blue-600/5 blur-[150px]" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <span className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 block">Initiate Project</span>
          <h3 className="text-5xl lg:text-7xl font-semibold text-white tracking-tight leading-[1] mb-8">
            Let's Build <br /> <span className="text-slate-400">Together.</span>
          </h3>
          <p className="text-lg text-slate-400 font-light leading-relaxed mb-16 max-w-2xl">
            Ready to optimize your operations? Join the growing network of companies relying on Leo Enterprises for mission-critical industrial solutions.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
            <div className="flex items-center gap-5 group cursor-pointer bg-white/5 border border-white/10 p-4 pr-8 rounded-full hover:bg-white/10 transition-all duration-300 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Direct Hotline</span>
                <span className="text-lg font-medium text-white tracking-tight">0994-606-4463</span>
              </div>
            </div>
            
            <div className="flex items-center gap-5 group cursor-pointer bg-white/5 border border-white/10 p-4 pr-8 rounded-full hover:bg-white/10 transition-all duration-300 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Official Email</span>
                <span className="text-lg font-medium text-white tracking-tight">contact@leoenterprises.ph</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      <footer className="relative bg-[#050505] py-24 border-t border-white/10 overflow-hidden">
        {/* Glossy Overlay */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-900 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="font-extrabold text-white text-sm">L</span>
                </div>
                <span className="font-bold text-slate-300 text-sm tracking-widest uppercase">LEO ENTERPRISES</span>
              </div>
              <p className="text-slate-500 text-xs font-light leading-relaxed max-w-[200px]">
                Industrial Multi-Service solutions delivered with precision.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="text-slate-300 font-bold uppercase tracking-widest text-[10px] mb-2">Company</h4>
              <a href="#services" className="text-slate-500 hover:text-white text-xs font-light transition-colors">Services</a>
              <a href="#about" className="text-slate-500 hover:text-white text-xs font-light transition-colors">Our Story</a>
              <a href="#contact" className="text-slate-500 hover:text-white text-xs font-light transition-colors">Contact</a>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-slate-300 font-bold uppercase tracking-widest text-[10px] mb-2">Access</h4>
              <Link to="/login" className="text-blue-500 hover:text-blue-400 text-xs font-light transition-colors">Employee Portal</Link>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-slate-300 font-bold uppercase tracking-widest text-[10px] mb-2">PWA Performance</h4>
              <p className="text-slate-600 text-xs font-light leading-relaxed">
                Built with precision, deployed for high-demand business environments.
              </p>
            </div>
          </div>
          
          <div className="w-full h-px bg-white/5 mb-8" />
          
          <div className="flex flex-col items-center text-center">
             <p className="text-slate-600 text-[10px] font-medium uppercase tracking-[0.2em]">
               © 2026 LEO ENTERPRISES ERP — ALL RIGHTS RESERVED.
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
