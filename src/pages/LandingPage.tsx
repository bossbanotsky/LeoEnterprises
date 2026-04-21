import React from 'react';
import { motion } from 'framer-motion';
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
  BarChart3
} from 'lucide-react';
import { Button } from '../components/ui/button';
import GalleryViewer from '../components/GalleryViewer';
import VideoViewer from '../components/VideoViewer';
import { Category } from '../services/galleryService';

const services = [
  {
    title: "Civil Works",
    icon: HardHat,
    description: "Expert construction and infrastructure development tailored to project specifications.",
    color: "blue"
  },
  {
    title: "Repairs & Maintenance",
    icon: Wrench,
    description: "Comprehensive technical support and structural repair services for lasting reliability.",
    color: "orange"
  },
  {
    title: "Hauling Services",
    icon: Truck,
    description: "Efficient logistical solutions for materials, debris, and industrial equipment.",
    color: "slate"
  },
  {
    title: "Fabrication",
    icon: Hammer,
    description: "Precision metal works and custom industrial fabrication for any technical need.",
    color: "indigo"
  },
  {
    title: "IT Services",
    icon: Cpu,
    description: "Advanced computing solutions, network management, and software support.",
    color: "teal"
  },
  {
    title: "CCTV Installation",
    icon: Camera,
    description: "State-of-the-art security systems and 24/7 surveillance infrastructure.",
    color: "red"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden selection:bg-blue-200 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-blue-500/10">
              <span className="text-white font-black text-xl">L</span>
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">LEO <span className="text-blue-600">ENTERPRISES</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#services" className="hover:text-blue-600 transition-colors">Services</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 text-sm font-bold px-6">Log In</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 flex flex-col items-center text-center px-4">
        {/* Background Decorative Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none z-0">
          <div className="absolute top-20 left-0 w-72 h-72 bg-blue-400/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-40 right-0 w-72 h-72 bg-amber-400/20 rounded-full blur-[120px] animate-pulse"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-widest mb-6">
            <Zap className="w-3 h-3" />
            Empowering Industrial Excellence
          </div>
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-8">
            Precision Solutions for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-amber-600">Enterprise Growth.</span>
          </h1>

        </motion.div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Our Expertise</h2>
            <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">Comprehensive Technical Services</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, idx) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <service.icon className="w-7 h-7 text-blue-600" />
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{service.title}</h4>
                <p className="text-slate-600 font-medium leading-relaxed">
                  {service.description}
                </p>
                <GalleryViewer category={service.title as Category} />
                <VideoViewer category={service.title as Category} />
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center text-blue-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn More <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight uppercase">Strategic Implementation</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto uppercase tracking-widest text-xs">A streamlined workflow designed for maximum efficiency</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Centralized Data", desc: "Consolidate all business processes into a single, high-performance platform." },
              { step: "02", title: "Smart Automation", desc: "Automate repetitive tasks in payroll and attendance to eliminate human error." },
              { step: "03", title: "Actionable Insights", desc: "Make data-driven decisions with real-time analytics and comprehensive reporting." }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="relative p-8 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 group hover:-translate-y-2 transition-all duration-500"
              >
                <div className="text-6xl font-black text-blue-900/5 absolute -top-4 -left-2 select-none group-hover:text-blue-600/10 transition-colors">{item.step}</div>
                <h3 className="text-xl font-black text-slate-900 mb-3 relative z-10">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed relative z-10 italic">{item.desc}</p>
                <div className="mt-6 w-12 h-1 bg-blue-600 rounded-full group-hover:w-20 transition-all duration-500"></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-[120px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-amber-500 opacity-50"></div>
              <h2 className="text-sm font-black text-amber-500 uppercase tracking-[0.2em] mb-4">About Leo Enterprises</h2>
              <h3 className="text-4xl lg:text-6xl font-black tracking-tight leading-tight mb-8">
                Building the Future of <span className="text-amber-500">Service Logistics.</span>
              </h3>
              <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
                With deep roots in Bauan, Batangas, Leo Enterprises has grown from a local contractor to a multi-disciplinary service powerhouse. We pride ourselves on operational excellence, safety, and delivering high-impact solutions for industrial and residential clients.
              </p>
              <div className="grid grid-cols-2 gap-8 mb-10">
                <div>
                  <div className="text-3xl font-black text-white mb-1">10+</div>
                  <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Years Experience</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-white mb-1">500+</div>
                  <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Projects Completed</div>
                </div>
              </div>
            </div>
            <div className="relative aspect-video lg:aspect-square bg-slate-800 rounded-3xl overflow-hidden border border-slate-700">
               <img 
                src="https://picsum.photos/seed/leo-ent/800/800" 
                alt="Construction Site" 
                className="w-full h-full object-cover opacity-60 hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8 right-8">
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <div className="flex items-center gap-4 mb-2">
                    <MapPin className="w-5 h-5 text-amber-500" />
                    <span className="font-bold italic">Santa Maria, Bauan, Batangas</span>
                  </div>
                  <p className="text-slate-300 text-sm font-medium">Headquarters & Operational Command Center</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Partners */}
      <section className="py-12 border-y border-slate-100 bg-slate-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
            {['Civil Works', 'Technical Services', 'IT Solutions', 'Security Experts', 'Fabrication'].map((partner, i) => (
              <span key={i} className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter uppercase italic">{partner}</span>
            ))}
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer id="contact" className="bg-slate-50 py-20 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black">L</span>
                </div>
                <span className="font-black text-xl tracking-tight text-slate-900">LEO <span className="text-blue-600">ENTERPRISES</span></span>
              </div>
              <p className="text-slate-500 font-medium leading-relaxed max-w-sm mb-6">
                Redefining precision and reliability in multi-service industry solutions across Southern Luzon.
              </p>
              <div className="flex items-center gap-4 text-slate-400">
                <Link to="#" className="hover:text-blue-600 transition-colors">Facebook</Link>
                <Link to="#" className="hover:text-blue-600 transition-colors">LinkedIn</Link>
                <Link to="#" className="hover:text-blue-600 transition-colors">Twitter</Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-sm">Quick Links</h4>
              <ul className="space-y-4 text-slate-500 font-medium">
                <li><a href="#services" className="hover:text-blue-600">Our Services</a></li>
                <li><a href="#about" className="hover:text-blue-600">Our Story</a></li>
                <li><Link to="/login" className="hover:text-blue-600">Login Portal</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-sm">Contact Details</h4>
              <ul className="space-y-4 text-slate-500 font-medium">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 mt-1 shrink-0" />
                  <span>Santa Maria, Bauan, Batangas, Philippines</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>0994-606-4463</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>contact@leoenterprises.ph</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm font-medium">
            <p>© 2026 Leo Enterprises ERP. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="#" className="hover:text-slate-600">Privacy Policy</Link>
              <Link to="#" className="hover:text-slate-600">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
