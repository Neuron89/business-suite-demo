'use client';

import { useEffect, useRef, useState } from 'react';
import HelpTableOfContents from '@/components/help/HelpTableOfContents';
import GettingStarted from '@/components/help/chapters/GettingStarted';
import DashboardChapter from '@/components/help/chapters/DashboardChapter';
import MocRequestsChapter from '@/components/help/chapters/MocRequestsChapter';
import TemplatesChapter from '@/components/help/chapters/TemplatesChapter';
import WorkflowChapter from '@/components/help/chapters/WorkflowChapter';
import RiskAssessmentChapter from '@/components/help/chapters/RiskAssessmentChapter';
import ReviewsApprovalsChapter from '@/components/help/chapters/ReviewsApprovalsChapter';
import PssrChapter from '@/components/help/chapters/PssrChapter';
import DsrChapter from '@/components/help/chapters/DsrChapter';
import ScopeValidationChapter from '@/components/help/chapters/ScopeValidationChapter';
import EhsIncidentsChapter from '@/components/help/chapters/EhsIncidentsChapter';
import AttachmentsPdfChapter from '@/components/help/chapters/AttachmentsPdfChapter';
import AdminFeaturesChapter from '@/components/help/chapters/AdminFeaturesChapter';
import TestingSectionChapter from '@/components/help/chapters/TestingSectionChapter';

const CHAPTERS = [
  { id: 'getting-started', number: 1, title: 'Getting Started' },
  { id: 'dashboard', number: 2, title: 'Dashboard' },
  { id: 'moc-requests', number: 3, title: 'MOC Requests' },
  { id: 'templates', number: 4, title: 'Templates' },
  { id: 'workflow', number: 5, title: 'Workflow & Status Flow' },
  { id: 'risk-assessment', number: 6, title: 'Risk Assessment' },
  { id: 'reviews-approvals', number: 7, title: 'Reviews & Approvals' },
  { id: 'pssr', number: 8, title: 'PSSR' },
  { id: 'dsr', number: 9, title: 'DSR' },
  { id: 'scope-validation', number: 10, title: 'Improvement Expected & Realized' },
  { id: 'ehs-incidents', number: 11, title: 'EHS Incidents' },
  { id: 'attachments-pdf', number: 12, title: 'Attachments & PDF' },
  { id: 'admin-features', number: 13, title: 'Admin Features' },
  { id: 'testing-section', number: 14, title: 'Testing Section' },
];

export default function HelpPage() {
  const [activeId, setActiveId] = useState(CHAPTERS[0].id);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    CHAPTERS.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-theme-primary">
          How to Use the MOC System
        </h1>
        <p className="text-sm mt-1 text-theme-muted">
          A complete guide to every feature in the Management of Change application.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sticky TOC sidebar */}
        <div className="hidden lg:block w-[220px] flex-shrink-0">
          <div className="sticky top-[80px]">
            <HelpTableOfContents items={CHAPTERS} activeId={activeId} />
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 min-w-0">
          <GettingStarted />
          <DashboardChapter />
          <MocRequestsChapter />
          <TemplatesChapter />
          <WorkflowChapter />
          <RiskAssessmentChapter />
          <ReviewsApprovalsChapter />
          <PssrChapter />
          <DsrChapter />
          <ScopeValidationChapter />
          <EhsIncidentsChapter />
          <AttachmentsPdfChapter />
          <AdminFeaturesChapter />
          <TestingSectionChapter />
        </div>
      </div>

      {/* Back to top button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 z-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          title="Back to top"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
