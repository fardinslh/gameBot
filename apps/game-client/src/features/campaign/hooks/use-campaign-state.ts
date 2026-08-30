'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CampaignBattleStartResponse, CampaignResponse, CampaignStageKey } from '@crown-and-coin/shared';
import { CampaignApiError, claimCampaignReward, fetchCampaign, startCampaignStage } from '../api/campaign-api';

export function useCampaignState(active: boolean) {
  const [state, setState] = useState<CampaignResponse | null>(null);
  const [result, setResult] = useState<CampaignBattleStartResponse | null>(null);
  const [selectedStageKey, setSelectedStageKey] = useState<CampaignStageKey | null>(null);
  const [action, setAction] = useState<'idle' | 'loading' | 'attacking' | 'claiming'>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setAction('loading');
    try {
      const response = await fetchCampaign(signal);
      setState(response);
      setErrorCode(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorCode(error instanceof CampaignApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, []);

  useEffect(() => {
    if (!active || state) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [active, refresh, state]);

  const attack = useCallback(async (stageKey?: CampaignStageKey) => {
    const targetStageKey = stageKey ?? selectedStageKey;
    if (!targetStageKey || action !== 'idle') return;
    setAction('attacking');
    try {
      const response = await startCampaignStage(targetStageKey);
      setResult(response);
      setState(response.campaign);
      setSelectedStageKey(null);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof CampaignApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action, selectedStageKey]);

  const claim = useCallback(async (stars: 9 | 18 | 27) => {
    if (action !== 'idle') return;
    setAction('claiming');
    try {
      const response = await claimCampaignReward(stars);
      setState(response.campaign);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof CampaignApiError ? error.code : 'SERVER_ERROR');
    } finally { setAction('idle'); }
  }, [action]);

  return {
    state,
    result,
    selectedStage: state?.chapter.stages.find((stage) => stage.key === selectedStageKey) ?? null,
    action,
    errorCode,
    refresh,
    attack,
    claim,
    selectStage: setSelectedStageKey,
    closeStage: () => setSelectedStageKey(null),
    clearResult: () => setResult(null),
  };
}
