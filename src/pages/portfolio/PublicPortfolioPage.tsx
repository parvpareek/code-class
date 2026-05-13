import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicPortfolio } from '@/api/portfolio';
import { PortfolioView } from '@/components/portfolio/PortfolioView';
import LoadingScreen from '@/components/ui/LoadingScreen';

const PublicPortfolioPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio', 'public', slug],
    queryFn: () => getPublicPortfolio(slug!),
    enabled: !!slug,
  });

  if (!slug) {
    return <p className="p-8 text-center text-muted-foreground">Missing slug</p>;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen p-8 text-center">
        <p className="text-muted-foreground">Portfolio not found or not published.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortfolioView
        displayName={data.displayName}
        content={data.content}
        platformSolved={data.platformSolved}
        activity={data.activity}
        theme={data.theme}
        portfolioSlug={slug}
      />
    </div>
  );
};

export default PublicPortfolioPage;
