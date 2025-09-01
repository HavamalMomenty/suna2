'use client';

import { siteConfig } from '@/lib/home';
import React from 'react';
import { motion } from 'framer-motion';

const IntroSection: React.FC = () => {
  return (
    <section id="intro" className="relative py-16 md:py-24 -mt-16 md:-mt-24">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-secondary/10 z-0"></div>
      <div className="container relative z-10 mx-auto max-w-5xl px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            {siteConfig.introSection.title}
          </h2>
          <div className="mx-auto max-w-3xl">
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10">
              {siteConfig.introSection.description}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="#use-cases" 
                className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Explore Use Cases
              </motion.a>
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/dashboard" 
                className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors"
              >
                Go to Dashboard
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default IntroSection;
