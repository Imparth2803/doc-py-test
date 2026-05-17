import React from 'react';
import { Check, Zap, Sparkles, Shield, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors z-20"
            >
              <X size={20} />
            </button>

            {/* Left: Value Prop */}
            <div className="w-full md:w-5/12 bg-gray-900 p-10 text-white relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent)]"></div>
               
               <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-10">
                     <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                        <Zap size={18} />
                     </div>
                     <span className="font-bold tracking-tight">Auto-File AI</span>
                  </div>

                  <h2 className="text-3xl font-bold leading-tight mb-6">Power your digital organization with Neural Intelligence.</h2>
                  
                  <div className="space-y-6 flex-1">
                     <FeatureItem label="Unlimited AI Categorization" />
                     <FeatureItem label="Advanced Entity Extraction" />
                     <FeatureItem label="Priority OCR Processing" />
                     <FeatureItem label="Legal Complexity Multiplier" />
                  </div>

                  <div className="mt-10 p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                     <p className="text-sm font-medium text-blue-300 mb-2">PRO TIP</p>
                     <p className="text-xs text-white/60 leading-relaxed italic">
                        "Since using the Pro Subscription, I've reduced my manual document sorting time by 90%. It's like having a digital assistant that never sleeps."
                     </p>
                  </div>
               </div>
            </div>

            {/* Right: Plans */}
            <div className="w-full md:w-7/12 p-10 bg-[#fafafa]">
               <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Choose your fuel</h3>
                  <p className="text-gray-500 font-medium">Select a plan that fits your filing frequency.</p>
               </div>

               <div className="grid grid-cols-1 gap-4">
                  <PlanCard 
                    title="Essential"
                    price="Free"
                    units="50 Units / mo"
                    description="Perfect for casual users."
                    active={false}
                  />
                  <PlanCard 
                    title="Professional"
                    price="₹299"
                    units="1000 Units / mo"
                    description="Our most popular plan for busy families."
                    popular
                    active={true}
                  />
                  <PlanCard 
                    title="Institutional"
                    price="₹999"
                    units="5000 Units / mo"
                    description="Unlimited entities and priority support."
                    active={false}
                  />
               </div>

               <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Top-up</h4>
                  <div className="flex gap-4">
                     <TopUpOption amount="₹49" units="100 Units" />
                     <TopUpOption amount="₹199" units="500 Units" />
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
         <Check size={12} strokeWidth={3} />
      </div>
      <span className="text-sm font-medium text-white/80">{label}</span>
    </div>
  );
}

function PlanCard({ title, price, units, description, popular, active }: { title: string, price: string, units: string, description: string, popular?: boolean, active: boolean }) {
  return (
    <div className={cn(
      "p-5 rounded-3xl border-2 transition-all relative cursor-pointer",
      active ? "bg-white border-blue-500 shadow-xl shadow-blue-500/5" : "bg-white border-gray-100 hover:border-gray-200"
    )}>
       {popular && (
         <div className="absolute top-5 right-5 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest">
            Best Value
         </div>
       )}
       <div className="flex justify-between items-end mb-2">
          <div>
             <h4 className="font-black text-gray-900 uppercase tracking-tight">{title}</h4>
             <p className="text-xs text-gray-400 font-medium">{description}</p>
          </div>
          <div className="text-right">
             <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-black text-gray-900">{price}</span>
                {price !== 'Free' && <span className="text-xs font-bold text-gray-400">/mo</span>}
             </div>
             <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{units}</p>
          </div>
       </div>
    </div>
  );
}

function TopUpOption({ amount, units }: { amount: string, units: string }) {
  return (
    <button className="flex-1 p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50/20 transition-all text-left group">
       <div className="flex items-center justify-between mb-1">
          <span className="text-lg font-black text-gray-900">{amount}</span>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
       </div>
       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{units}</span>
    </button>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
