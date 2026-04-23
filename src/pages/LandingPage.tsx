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
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "maintenance",
    title: "Maintenance Services",
    icon: Wrench,
    description: "Full-scale equipment management and facility maintenance for operational longevity.",
    category: "Repairs & Maintenance" as Category,
    color: "indigo",
    image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "it-services",
    title: "IT Solutions & Networking",
    icon: Cpu,
    description: "Advanced computing infrastructure, secure networking, and enterprise software systems.",
    category: "IT Services" as Category,
    color: "teal",
    image: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&q=80&w=1200"
  },
  {
    slug: "cctv",
    title: "CCTV & Security Systems",
    icon: Camera,
    description: "High-definition surveillance and integrated security protocols for 24/7 protection.",
    category: "CCTV Installation" as Category,
    color: "red",
    image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=1200"
  }
];


export default function LandingPage() {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden selection:bg-blue-200 selection:text-blue-900 relative font-sans">
      <PWAInstallPrompt />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tighter text-white leading-none group-hover:text-blue-500 transition-colors">
                LEO <span className="font-black italic tracking-tight text-blue-500 underline decoration-blue-500/30 underline-offset-4">ENTERPRISES</span>
              </span>
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mt-1 italic">Industrial Multi-Service</span>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-[14px] font-bold text-white/80 tracking-tight uppercase">
            <a href="#services" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1 hover:tracking-[0.1em]">Services</a>
            <a href="#about" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1 hover:tracking-[0.1em]">About</a>
            <a href="#contact" className="hover:text-white hover:text-blue-400 transition-all duration-300 py-1 hover:tracking-[0.1em]">Contact</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button className="rounded-full bg-white hover:bg-slate-100 text-slate-950 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] text-[14px] font-black px-8 py-5 transition-all duration-300 border-0 active:scale-95 uppercase tracking-widest">
                Login Portal
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        {/* Using Global Fixed Background */}
        <div className="absolute inset-0 z-0 bg-transparent" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-6xl"
        >
          <h1 className="text-6xl md:text-8xl lg:text-[130px] font-black italic tracking-[-0.05em] leading-[0.9] mb-10 uppercase">
            <span className="text-[#2563EB]">COMPLETE</span> <br /> 
            <span className="text-white">INDUSTRIAL &</span> <br /> 
            <span className="text-white">TECHNICAL</span> <br /> 
            <span className="text-[#2563EB]">SOLUTIONS.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto font-bold leading-relaxed tracking-tight mb-16">
            From heavy-duty hauling to high-tech digital systems, we provide comprehensive services built for performance, reliability, and precision business growth.
          </p>

          <a href="#services">
            <Button className="h-20 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-[18px] font-black px-12 transition-all duration-300 shadow-2xl border-0 uppercase italic tracking-tighter">
              View Services
            </Button>
          </a>
        </motion.div>
      </section>


      {/* Services Grid Section */}
      <section id="services" className="relative py-32 lg:py-48 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-32 max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-[#2563EB] uppercase tracking-tight mb-8 [text-shadow:0_2px_4px_rgba(255,255,255,0.2)]">Our Expertise</h2>
            <h3 className="text-5xl lg:text-7xl font-bold text-white tracking-[-0.04em] leading-[0.95] mb-10 uppercase italic">Multi-Industry <br /> Professional Services</h3>
            <p className="text-xl text-white/80 leading-[1.6] font-bold tracking-tight">
              We leverage modern technology and heavy industry experience to deliver end-to-end solutions for high-demand business environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {services.map((service, idx) => (
              <Link
                to={`/services/${service.slug}`}
                key={service.title}
                className="group p-10 lg:p-12 rounded-[32px] bg-slate-900 border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.2)] hover:-translate-y-2 transition-all duration-500 ease-out flex flex-col relative overflow-hidden h-[550px]"
              >
                {/* 100% Visible HD Image Background */}
                <div className="absolute inset-0 z-0">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-100"
                    referrerPolicy="no-referrer"
                  />
                  {/* Premium Scrim for Text Readability */}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.4)_40%,rgba(15,23,42,0.95)_100%)]" />
                </div>

                <div className="relative z-10 h-full flex flex-col justify-end">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 shadow-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500 border border-white/20">
                    <service.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h4 className="text-3xl font-black text-white mb-4 tracking-[-0.02em] group-hover:text-blue-400 transition-colors uppercase italic">{service.title}</h4>
                  <p className="text-slate-200 leading-[1.5] text-lg mb-8 font-medium tracking-tight opacity-90 line-clamp-3">
                    {service.description}
                  </p>
                  
                  <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white uppercase tracking-[3px] group-hover:text-blue-400 transition-colors">Learn More</span>
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 border border-white/20">
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-white" />
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
              <h2 className="text-[11px] font-bold text-blue-400 uppercase tracking-[4px] mb-8">Our Identity</h2>
              <h3 className="text-5xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.95] mb-12 uppercase italic">
                Redefining <br /> <span className="text-blue-500">Service</span> Excellence.
              </h3>
              <p className="text-slate-400 text-xl font-medium leading-relaxed mb-12 tracking-tight">
                Headquartered in Bauan, Batangas, Leo Enterprises delivers mission-critical technical services across the region. We combine elite operational safety with innovative problem-solving.
              </p>
              
              <div className="grid grid-cols-2 gap-12 border-t border-slate-800 pt-12">
                <div>
                  <div className="text-5xl font-black text-white mb-2 leading-none uppercase italic tracking-tighter">12+</div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-[2px]">Years of Operations</div>
                </div>
                <div>
                  <div className="text-5xl font-black text-white mb-2 leading-none uppercase italic tracking-tighter">800+</div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-[2px]">Expert Projects</div>
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
              <div className="aspect-square bg-slate-900 rounded-[50px] overflow-hidden border border-slate-800 shadow-[0_40px_100px_rgba(0,0,0,0.5)] p-1">
                <div className="w-full h-full rounded-[45px] overflow-hidden relative group">
                  <img 
                    src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=2070" 
                    alt="Team work" 
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-[2000ms]"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="w-24 h-24 rounded-full bg-blue-600/20 border border-white/30 flex items-center justify-center">
                      <ZapIcon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Stat Card */}
              <div className="absolute -bottom-10 -left-10 bg-white/10 border border-white/20 p-8 rounded-[30px] shadow-2xl hidden md:block">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-lg uppercase tracking-tight italic">Elite Team</span>
                </div>
                <p className="text-slate-300 text-sm font-medium tracking-tight leading-relaxed max-w-[200px]">
                  Powered by over 100+ highly specialized technical personnel.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Why Choose Us */}
      <section className="py-32 lg:py-48 bg-transparent relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-[11px] font-bold text-blue-400 uppercase tracking-[4px] mb-8">Competitive Edge</h2>
            <h3 className="text-5xl lg:text-7xl font-bold text-white tracking-[-0.04em] leading-[0.95] uppercase italic">Why the Industry <br /> Prefers LEO</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: "Fast Response", desc: "Agile project deployment and 24/7 technical support accessibility." },
              { icon: Award, title: "Skilled Force", desc: "Highly certified technical teams with years of specialized field experience." },
              { icon: ShieldCheck, title: "Reliable Gear", desc: "State-of-the-art fleet and high-precision technical equipment." },
              { icon: CheckCircle2, title: "Local Trust", desc: "A proven track record with Bauan's most critical industrial facilities." }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-10 rounded-[30px] bg-slate-900 border border-white/5 shadow-2xl group hover:bg-white hover:text-slate-950 transition-all duration-500"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-900/30 flex items-center justify-center mb-8 group-hover:bg-blue-600 transition-colors">
                  <item.icon className="w-6 h-6 text-blue-400 group-hover:text-white" />
                </div>
                <h4 className="text-xl font-bold mb-4 tracking-tight uppercase italic">{item.title}</h4>
                <p className="text-slate-400 group-hover:text-slate-600 text-[15px] font-medium leading-relaxed tracking-tight">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 lg:py-56 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-24">
            <div>
              <h2 className="text-[11px] font-bold text-blue-400 uppercase tracking-[4px] mb-8 text-left">Initiate Project</h2>
              <h3 className="text-5xl lg:text-8xl font-bold text-white tracking-[-0.05em] leading-[0.85] mb-12 uppercase italic text-left">
                Let's Build <br /> <span className="text-blue-500">Together.</span>
              </h3>
              <p className="text-xl text-white/80 font-bold leading-relaxed mb-12 tracking-tight">
                Ready to optimize your operations? Join the growing network of companies relying on Leo Enterprises for mission-critical industrial solutions.
              </p>
              
              <div className="space-y-8">
                <div className="flex items-center gap-6 group cursor-pointer">
                  <div className="w-14 h-14 rounded-full bg-slate-900/40 border border-white/10 flex items-center justify-center text-white group-hover:bg-blue-600 transition-colors">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Direct Hotline</span>
                    <span className="text-2xl font-bold text-white tracking-tighter hover:text-blue-400 transition-colors">0994-606-4463</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 group cursor-pointer">
                  <div className="w-14 h-14 rounded-full bg-slate-900/40 border border-white/10 flex items-center justify-center text-white group-hover:bg-blue-600 transition-colors">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Official Email</span>
                    <span className="text-2xl font-bold text-white tracking-tighter hover:text-blue-400 transition-colors">contact@leoenterprises.ph</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-50 border border-slate-100 p-10 lg:p-14 rounded-[50px] shadow-2xl relative z-10 flex flex-col gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Full Name</label>
                  <Input 
                    placeholder="Enter your name" 
                    className="h-16 lg:h-18 rounded-[20px] border-slate-200 bg-white text-slate-900 text-lg font-medium px-6 focus:ring-4 focus:ring-blue-600/10 transition-all shadow-sm placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Company / Phone</label>
                  <Input 
                    placeholder="Phone or Organization" 
                    className="h-16 lg:h-18 rounded-[20px] border-slate-200 bg-white text-slate-900 text-lg font-medium px-6 focus:ring-4 focus:ring-blue-600/10 transition-all shadow-sm placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Project Message</label>
                  <textarea 
                    className="w-full min-h-[160px] rounded-[30px] border border-slate-200 bg-white p-6 text-slate-900 text-lg font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all shadow-sm resize-none placeholder:text-slate-400"
                    placeholder="Brief description of your project requirements"
                  />
                </div>
                
                <Button className="h-16 lg:h-20 rounded-[25px] bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold uppercase italic tracking-tighter transition-all active:scale-95 shadow-xl shadow-blue-600/10 mt-4 group">
                  Submit Proposal <ArrowRight className="ml-4 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </div>
              
              {/* Decorative side element */}
              <div className="absolute top-1/2 -right-12 -translate-y-1/2 w-24 h-48 bg-blue-600/10 rounded-full blur-[80px] -z-0" />
            </div>
          </div>
        </div>
      </section>


      <footer className="bg-slate-950/50 backdrop-blur-sm border-t border-white/5 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="font-black text-white text-xl">L</span>
                </div>
                <span className="font-black text-white text-lg tracking-tight uppercase italic">LEO ENTERPRISES</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Industrial Multi-Service solutions delivered with precision and technical excellence.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-2">Company</h4>
              <a href="#services" className="text-slate-400 hover:text-white text-sm transition-colors">Services</a>
              <a href="#about" className="text-slate-400 hover:text-white text-sm transition-colors">Our Story</a>
              <a href="#contact" className="text-slate-400 hover:text-white text-sm transition-colors">Contact</a>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-2">Access</h4>
              <Link to="/login" className="text-blue-500 hover:text-blue-400 text-sm transition-colors">Employee Portal</Link>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-2">PWA Performance</h4>
              <p className="text-slate-500 text-xs italic">
                Built with precision, deployed for high-demand business environments.
              </p>
            </div>
          </div>
          
          <div className="w-full h-px bg-white/10 mb-12" />
          
          <div className="flex flex-col items-center text-center">
             <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-[0.2em]">
               © 2026 LEO ENTERPRISES ERP — ALL RIGHTS RESERVED.
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
