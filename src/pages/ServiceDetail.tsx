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
  ChevronDown,
  Recycle
} from 'lucide-react';
import { Category } from '../services/galleryService';
import GalleryViewer from '../components/GalleryViewer';
import VideoViewer from '../components/VideoViewer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button } from '../components/ui/button';

const serviceData: Record<string, any> = {
  "trading": {
    title: "Scrap & Metal Trading (Junkshop)",
    icon: Recycle,
    category: "Scrap Trading",
    description: "L & P Scrap Trading and Junkshop operates under strict precision weighing, offering top competitive pricing for all varieties of recyclable materials. We buy bulk scraps from commercial, residential, and industrial partners.",
    details: [
      "We buy all kinds of metal scraps (iron, steel, copper wire, aluminum, brass)",
      "Used lead-acid batteries and scrap automotive electronics",
      "Industrial machinery decommissioning, dismantling, and retrievement",
      "Cardboard cartons, paper, structural materials, and reusable plastics"
    ],
    image: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=1200"
  },
  "hauling": {
    title: "All Kinds of Hauling Services",
    icon: Truck,
    category: "Hauling Services",
    description: "Our hauling and logistics services are designed for heavy-duty industrial and junkshop transport needs. We utilize a modern fleet of bulk dump trucks and certified operators to ensure safe, timely, and efficient transport of materials, scraps, debris, and high-value equipment.",
    details: [
      "Heavy industrial materials and bulk scrap hauling",
      "Excavation clearing, debris removal & construction site cleanup",
      "Lifting, loading, and high-capacity dumping logistics",
      "Modernized logistics planning & heavy equipment mobilization support"
    ],
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200"
  },
  "civil-works": {
    title: "Civil Works & Construction Support",
    icon: HardHat,
    category: "Civil Works",
    description: "From structural foundations to construction finishing, our civil works team delivers robust engineering support. We specialize in construction projects, structural fabrications, brickwork, masonry, and steel installations.",
    details: [
      "Structural foundations, steel fixing, and concrete pouring",
      "Land excavation, grading, profiling, and earthworks clearing support",
      "Masonry walls, plaster works, and professional bricklaying",
      "Heavy construction framework setup and customized civil developments"
    ],
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1200"
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
              <span className="text-white font-black">LP</span>
            </div>
            <span className="font-bold text-slate-900 uppercase italic tracking-tighter">L & P</span>
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
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[4px]">L & P Trading and Services © 2026</p>
      </footer>
    </div>
  );
}
