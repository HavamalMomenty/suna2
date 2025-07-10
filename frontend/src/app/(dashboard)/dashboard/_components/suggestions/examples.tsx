'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Bot,
  Briefcase,
  Settings,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Target,
  Brain,
  Globe,
  Heart,
  PenTool,
  Code,
  Camera,
  Calendar,
  DollarSign,
  Rocket,
} from 'lucide-react';

type PromptExample = {
  title: string;
  query: string;
  icon: React.ReactNode;
};

const allPrompts: PromptExample[] = [
  {
    title: 'Investment Memorandum screening with UW',
    query: 'Act as an experienced private equity real estate analyst specializing in Danish assets: review all documents. including spreadsheets, PDFs and supporting files, and extract, analyze. Included are the following documents. The point of the IC is not to "sell" the property, acts as an objective investigator. An example of a correctly produced IC for another property.',
    icon: <BarChart3 className="text-green-700 dark:text-green-400" size={16} />,
  },
  {
    title: 'Real estate research in N and AA',
    query: 'Investigate all for sale units in Næstved and Aabenraa and find the best cases to invest in.',
    icon: <Bot className="text-blue-700 dark:text-blue-400" size={16} />,
  },
  {
    title: 'Make a funny analysis of Bjarke Erichsen',
    query: 'Make a funny analysis of Bjarke Erichsen',
    icon: <Bot className="text-blue-700 dark:text-blue-400" size={16} />,
  },

];

// Function to get random prompts
const getRandomPrompts = (count: number = 3): PromptExample[] => {
  const shuffled = [...allPrompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const Examples = ({
  onSelectPrompt,
}: {
  onSelectPrompt?: (query: string) => void;
}) => {
  const [displayedPrompts, setDisplayedPrompts] = useState<PromptExample[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize with random prompts on mount
  useEffect(() => {
    setDisplayedPrompts(getRandomPrompts(3));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setDisplayedPrompts(getRandomPrompts(3));
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-muted-foreground font-medium">Workflows</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <RefreshCw size={10} />
          </motion.div>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {displayedPrompts.map((prompt, index) => (
          <motion.div
            key={`${prompt.title}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: "easeOut"
            }}
          >
            <Card
              className="group cursor-pointer h-full shadow-none transition-all bg-sidebar hover:bg-neutral-100 dark:hover:bg-neutral-800/60 p-0 justify-center"
              onClick={() => onSelectPrompt && onSelectPrompt(prompt.query)}
            >
              <CardHeader className="p-2 grid-rows-1">
                <div className="flex items-start justify-center gap-1.5">
                  <div className="flex-shrink-0 mt-0.5">
                    {React.cloneElement(prompt.icon as React.ReactElement, { size: 14 })}
                  </div>
                  <CardTitle className="font-normal group-hover:text-foreground transition-all text-muted-foreground text-xs leading-relaxed line-clamp-3">
                    {prompt.title}
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};