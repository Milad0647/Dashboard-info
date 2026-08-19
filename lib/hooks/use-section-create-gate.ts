"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SectionTutorialModal } from "@/components/admin/section-tutorial-modal";
import {
  completeTutorialAction,
  getTutorialStatusAction,
} from "@/lib/actions/tutorial-actions";
import { checkDailyQuotaAction } from "@/lib/actions/extended-actions";
import type { TutorialSectionKey, TutorialStep } from "@/lib/section-tutorials";
import { tutorialSectionLabels } from "@/lib/section-tutorials";

interface TutorialGateState {
  loaded: boolean;
  bypass: boolean;
  hasContent: boolean;
  isCompleted: boolean;
  title: string;
  steps: TutorialStep[];
}

const initialState: TutorialGateState = {
  loaded: false,
  bypass: false,
  hasContent: false,
  isCompleted: false,
  title: "",
  steps: [],
};

/**
 * Gates the first create action for contributors behind a multi-step tutorial.
 * Admins bypass. Missing tutorial content keeps create blocked.
 */
export function useSectionCreateGate(sectionKey: TutorialSectionKey, campaignId?: string) {
  const [state, setState] = useState<TutorialGateState>({
    ...initialState,
    title: tutorialSectionLabels[sectionKey],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const pendingCreateRef = useRef<(() => void) | null>(null);

  const refreshStatus = useCallback(async () => {
    const result = await getTutorialStatusAction(sectionKey);
    if (!result.success) {
      setState((prev) => ({ ...prev, loaded: true, bypass: false, isCompleted: false }));
      return;
    }

    setState({
      loaded: true,
      bypass: Boolean(result.bypass),
      hasContent: result.status.hasContent,
      isCompleted: result.status.isCompleted,
      title: result.status.title || tutorialSectionLabels[sectionKey],
      steps: result.status.steps,
    });
  }, [sectionKey]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const runCreate = useCallback((onCreate: () => void) => {
    pendingCreateRef.current = null;
    onCreate();
  }, []);

  const requestCreate = useCallback(
    async (onCreate: () => void) => {
      if (campaignId) {
        const quota = await checkDailyQuotaAction(sectionKey, campaignId);
        if (!quota.ok) {
          toast.error(quota.error);
          return;
        }
      }

      let current = state;

      if (!current.loaded) {
        const result = await getTutorialStatusAction(sectionKey);
        if (!result.success) {
          toast.error(result.error ?? "بررسی آموزش ناموفق بود");
          return;
        }
        current = {
          loaded: true,
          bypass: Boolean(result.bypass),
          hasContent: result.status.hasContent,
          isCompleted: result.status.isCompleted,
          title: result.status.title || tutorialSectionLabels[sectionKey],
          steps: result.status.steps,
        };
        setState(current);
      }

      if (current.bypass || current.isCompleted) {
        runCreate(onCreate);
        return;
      }

      pendingCreateRef.current = onCreate;
      setModalOpen(true);
    },
    [runCreate, sectionKey, state, campaignId]
  );

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      const result = await completeTutorialAction(sectionKey);
      if (!result.success) {
        toast.error(result.error ?? "ثبت تکمیل آموزش ناموفق بود");
        return;
      }

      setState((prev) => ({ ...prev, isCompleted: true }));
      setModalOpen(false);

      const pending = pendingCreateRef.current;
      pendingCreateRef.current = null;
      if (pending) {
        pending();
      }
    } finally {
      setCompleting(false);
    }
  }, [sectionKey]);

  const tutorialModal = createElement(SectionTutorialModal, {
      open: modalOpen,
      onOpenChange: (open: boolean) => {
        setModalOpen(open);
        if (!open) {
          pendingCreateRef.current = null;
        }
      },
      title: state.title || tutorialSectionLabels[sectionKey],
      steps: state.steps,
      unavailable: !state.hasContent,
      completing,
      onComplete: () => {
        void handleComplete();
      },
    });

  return {
    requestCreate,
    tutorialModal,
    isTutorialReady: state.loaded,
    isTutorialCompleted: state.bypass || state.isCompleted,
    hasTutorialContent: state.hasContent,
    refreshTutorialStatus: refreshStatus,
  };
}
