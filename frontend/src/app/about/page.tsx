import { Metadata } from 'next';
import { siteConfig } from '@/lib/home';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FlickeringGrid } from '@/components/home/ui/flickering-grid';

export const metadata: Metadata = {
  title: 'About | Momenty Node',
  description: 'Learn more about Momenty Node, our mission, and our team.',
};

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <FlickeringGrid
          className="h-full w-full"
          squareSize={2}
          gridGap={3}
          maxOpacity={0.3}
          flickerChance={0.15}
        />
      </div>
      
      <div className="container max-w-3xl mx-auto py-20 md:py-28 px-4 relative z-10">
        <div className="flex flex-col items-center text-center mb-20">
          <div className="mb-8">
            <div className="inline-block p-3 bg-secondary/20 rounded-full mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7 text-secondary"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Momenty</h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Reimagining what's possible
          </p>
        </div>

        <div className="grid gap-16">
          <Card className="border-none shadow-xl bg-background/40 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent"></div>
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col gap-8 items-center text-center">
                <div className="relative size-20 md:size-24 rounded-full bg-secondary/10 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">The Story</h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    A small group of AI researchers from DTU noticed something peculiar: in a world of rapid technological 
                    advancement, real estate and private equity remained anchored to spreadsheets and manual processes.
                  </p>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    We asked ourselves: <span className="italic">What if?</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-background/40 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-transparent to-secondary"></div>
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col gap-8 items-center text-center">
                <div className="relative size-20 md:size-24 rounded-full bg-secondary/10 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="m2 12 5-3 2 6 5-5 2 4 6-4" />
                  </svg>
                </div>
                <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">The Transformation</h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    We're creating something that shouldn't be possible: AI that understands the nuances of financial 
                    analysis in real estate and private equity, transforming complex documents into actionable insights.
                  </p>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Our first creation: a system that reads investment memoranda and generates precise financial models 
                    and committee papers—automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-secondary/10 via-secondary/20 to-secondary/10 p-10 rounded-xl">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Curious?</h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                We're just getting started. The future of financial analysis is being written now.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-white">
                  <Link href="/contact">
                    Join the Conversation
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
