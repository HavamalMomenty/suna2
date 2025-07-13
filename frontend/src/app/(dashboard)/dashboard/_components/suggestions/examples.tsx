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
  query?: string;
  queryFromFile?: string;
  icon: React.ReactNode;
  files?: string[];
};

const allPrompts: PromptExample[] = [
  {
    title: 'Investment Memorandum screening with UW',
    queryFromFile: '/Instruction_documents/prompt.md',
    icon: <BarChart3 className="text-green-700 dark:text-green-400" size={16} />,
    files: [
      '/Instruction_documents/company_information.md',
      '/Instruction_documents/IC_overview.md',
      '/Instruction_documents/howToUseRedata.html',
      '/Instruction_documents/Realestatemetrics.md',
      '/Instruction_documents/Optimized_IC_Analysis_Workflow.md',
      '/Instruction_documents/AI_Model_IC_Instructions.md',
      '/Instruction_documents/Financial_Residential_Investment_Template.xlsx',


    ],
  },
];

// Function to get random prompts
const getRandomPrompts = (count: number = 3): PromptExample[] => {
  const shuffled = [...allPrompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const Examples = ({
  onSelectPrompt,
  onSelectWorkflow,
  isLoading,
}: {
  onSelectPrompt?: (query: string) => void;
  onSelectWorkflow?: (workflow: { query?: string; files?: string[], queryFromFile?: string }) => void;
  isLoading?: boolean;
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
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground">For you</h3>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {displayedPrompts.map((prompt, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="cursor-pointer group hover:bg-muted/50 transition-all h-full"
              onClick={() => !isLoading && onSelectWorkflow?.(prompt)}
              disabled={isLoading}
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