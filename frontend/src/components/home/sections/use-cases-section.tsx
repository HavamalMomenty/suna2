'use client';

import { siteConfig } from '@/lib/home';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Star } from 'lucide-react';

const UseCasesSection: React.FC = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section id="use-cases" className="py-20 md:py-32 bg-gradient-to-b from-secondary/10 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {siteConfig.useCasesSection.title}
            </h2>
            <div className="w-24 h-1 bg-primary mx-auto mb-6"></div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover how our platform transforms workflows across different industries
            </p>
          </motion.div>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-2 gap-10"
        >
          {siteConfig.useCasesSection.cases.map((useCase, idx) => (
            <motion.div key={useCase.id} variants={item}>
              <Card className="bg-background border-2 border-muted hover:border-primary/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">{useCase.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{useCase.subtitle}</p>
                    </div>
                    {idx === 0 && (
                      <span className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full font-medium">
                        Featured
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-6 text-muted-foreground">{useCase.description}</p>
                  
                  {useCase.features.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3 flex items-center text-primary">
                        <Star className="w-4 h-4 mr-2" /> Key Features
                      </h4>
                      <ul className="space-y-2">
                        {useCase.features.map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {useCase.impact && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <h4 className="font-semibold mb-3 text-primary">{useCase.impact.title}</h4>
                      <ul className="space-y-3">
                        {useCase.impact.points.map((point, index) => (
                          <li key={index} className="flex items-start">
                            <ArrowRight className="w-4 h-4 text-primary mr-2 mt-1 flex-shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {useCase.partner && (
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                      <p className="text-sm text-muted-foreground italic">{useCase.partner}</p>
                      <motion.button 
                        whileHover={{ x: 5 }}
                        className="text-primary text-sm font-medium flex items-center"
                      >
                        Read more <ArrowRight className="ml-1 w-3 h-3" />
                      </motion.button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default UseCasesSection;
