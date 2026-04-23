import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Truck, 
  HardHat, 
  Hammer, 
  Wrench, 
  Cpu, 
  Camera, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Settings,
  ChevronDown
} from 'lucide-react';
import { Category } from '../services/galleryService';
import GalleryViewer from '../components/GalleryViewer';
import VideoViewer from '../components/VideoViewer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button } from '../components/ui/button';

const serviceData: Record<string, any> = {
  "hauling": {
    title: "Hauling & Logistics",
    icon: Truck,
    category: "Hauling Services",
    description: "Our hauling and logistics services are designed for heavy-duty industrial needs. We utilize a modern fleet and certified operators to ensure safe, timely, and efficient transport of materials, debris, and high-value equipment.",
    details: [
      "Industrial material transport",
      "Debris removal & management",
      "Heavy equipment mobilization",
      "End-to-end logistics planning"
    ],
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200"
  },
  "civil-works": {
    title: "Civil Works & Construction",
    icon: HardHat,
    category: "Civil Works",
    description: "From structural foundations to project completion, our civil works team delivers robust engineering solutions. We specialize in construction support that meets the most demanding industrial standards.",
    details: [
      "Structural foundation works",
      "Project infrastructure support",
      "General construction services",
      "Facility renovation & expansion"
    ],
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1200"
  },
  "fabrication": {
    title: "Fabrication & Metal Works",
    icon: Hammer,
    category: "Fabrication",
    description: "High-precision metal fabrication tailored to your specific technical requirements. Our shop handles everything from custom structural components to complex industrial repairs.",
    details: [
      "Custom metal fabrication",
      "Industrial welding services",
      "Structural steel works",
      "Precision tool & die repairs"
    ],
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200"
  },
  "maintenance": {
    title: "Maintenance Services",
    icon: Wrench,
    category: "Repairs & Maintenance",
    description: "Operational longevity depends on expert maintenance. We provide comprehensive facility and equipment management services to prevent downtime and optimize performance.",
    details: [
      "Preventive maintenance programs",
      "Facility equipment management",
      "Mechanical system repairs",
      "Utility system optimization"
    ],
    image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=1200"
  },
  "it-services": {
    title: "IT Solutions & Networking",
    icon: Cpu,
    category: "IT Services",
    description: "Powering your digital infrastructure with advanced networking and enterprise software solutions. We ensure your business stays connected and secure in an evolving digital landscape.",
    details: [
      "Enterprise network setup",
      "Cybersecurity implementation",
      "Cloud system management",
      "Technical software support"
    ],
    image: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&q=80&w=1200"
  },
  "cctv": {
    title: "CCTV & Security Systems",
    icon: Camera,
    category: "CCTV Installation",
    description: "State-of-the-art surveillance and integrated security protocols. We design and install high-definition monitoring systems that provide 24/7 protection for your assets.",
    details: [
      "HD surveillance installation",
      "Remote monitoring systems",
      "Access control integration",
      "Integrated alarm solutions"
    ],
    image: "https://images.unsplash.com/photo-1454165833767-027eeed15c3e?auto=format&fit=crop&q=80&w=1200"
  }
};

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const service = slug ? serviceData[slug] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Link to="/" className="text-blue-600 hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  const Icon = service.icon;

  return (
    <div className="min-h-screen bg-white">
      {/* Dynamic Header */}
      <nav className="fixed top-0 w-full z-50 bg-white/60 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
              <span className="text-white font-black">L</span>
            </div>
            <span className="font-bold text-slate-900 uppercase italic tracking-tighter">Leo </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 uppercase tracking-widest text-xs">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Content */}
      <section className="pt-40 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
               initial={{ opacity: 0, x: -30 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-10">
                <Icon className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-4xl lg:text-7xl font-bold text-slate-900 tracking-[-0.04em] leading-[0.95] mb-8 uppercase italic">
                {service.title}
              </h1>
              <p className="text-xl text-[#6b7280] font-medium leading-relaxed mb-12 tracking-tight">
                {service.description}
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6">
                 {service.details.map((detail: string, i: number) => (
                   <div key={i} className="flex items-center gap-3">
                     <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
                       <ChevronRight className="w-4 h-4" />
                     </div>
                     <span className="text-slate-700 font-bold tracking-tight uppercase italic text-sm">{detail}</span>
                   </div>
                 ))}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative aspect-square rounded-[60px] overflow-hidden border-8 border-slate-50 shadow-2xl shadow-slate-200"
            >
              <img 
                src={service.image} 
                alt={service.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-slate-900/10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-20">
             <div className="flex items-center gap-4">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-slate-900 font-bold uppercase italic tracking-tighter">Certified Quality</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Standards</span>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <Clock className="w-8 h-8 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-slate-900 font-bold uppercase italic tracking-tighter">24/7 Support</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Always Online</span>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <Settings className="w-8 h-8 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-slate-900 font-bold uppercase italic tracking-tighter">Modern Fleet</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Latest Tech</span>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Specialized Content / Portfolio on this service */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-20">
            <h2 className="text-[11px] font-bold text-blue-600 uppercase tracking-[4px] mb-6">Visual Proof</h2>
            <h3 className="text-4xl lg:text-6xl font-bold text-slate-900 tracking-[-0.04em] uppercase italic">Service Showcase.</h3>
          </div>
          
          <div className="rounded-[50px] bg-slate-50/50 border border-slate-100 p-8 md:p-12">
            <ErrorBoundary>
              <GalleryViewer category={service.category as Category} isAdminView={false} />
            </ErrorBoundary>
            <ErrorBoundary>
              <VideoViewer category={service.category as Category} isAdminView={false} />
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-slate-950 text-white text-center px-4">
        <h2 className="text-3xl md:text-5xl font-bold uppercase italic tracking-tighter mb-8">Ready to Start Your Project?</h2>
        <Link to="/#contact">
          <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-16 px-10 text-lg uppercase tracking-tighter italic">
            Get a Custom Quote
          </Button>
        </Link>
      </section>

      <footer className="py-12 bg-slate-950 border-t border-white/5 text-center">
         <p className="text-slate-500 text-xs font-bold uppercase tracking-[4px]">Leo Enterprises © 2026</p>
      </footer>
    </div>
  );
}
