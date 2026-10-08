/** Cold-resume labels must follow the session view through the composer boundary. */
import { useStore } from '@nanostores/react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyStoredSessionPreviewRuntimeInfo } from '@/app/session/hooks/use-session-actions/utils'
import { createClientSessionState } from '@/lib/chat-runtime'
import { formatModelPillLabel } from '@/lib/model-status-label'
import {
  $activeSessionId,
  $selectedStoredSessionId,
  setCurrentModel,
  setCurrentModelSource,
  setCurrentProvider
} from '@/store/session'
import { $sessionStates, publishSessionState } from '@/store/session-states'

import { PRIMARY_SESSION_VIEW as view } from '../session-view'

import { ModelPill } from './model-pill'

const rememberedModel = 'kimi-k3'
const resumedModel = 'glm-5.3-flash'

interface BoundModelPillProps {
  liveMenu: boolean
}

function BoundModelPill({ liveMenu }: BoundModelPillProps) {
  // Match ChatView's subscriptions: model props update from the real session view.
  const currentModel = useStore(view.$model)
  const currentProvider = useStore(view.$provider)

  return (
    <ModelPill
      disabled={false}
      model={{
        canSwitch: true,
        model: currentModel,
        provider: currentProvider,
        modelMenuContent: liveMenu ? <div>Available models</div> : undefined
      }}
    />
  )
}

function mountPill(liveMenu: boolean) {
  return render(<BoundModelPill liveMenu={liveMenu} />)
}

function expectPendingModel() {
  expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
  expect(screen.queryByText(formatModelPillLabel(rememberedModel))).toBeNull()
  expect(screen.queryByTestId('model-pinned-dot')).toBeNull()
}

beforeEach(() => {
  $sessionStates.set({})
  $activeSessionId.set(null)
  $selectedStoredSessionId.set(null)
  setCurrentModel(rememberedModel)
  setCurrentProvider('kimi-coding')
  setCurrentModelSource('manual')
})

afterEach(() => {
  cleanup()
  $sessionStates.set({})
  $activeSessionId.set(null)
  $selectedStoredSessionId.set(null)
  setCurrentModel('')
  setCurrentProvider('')
  setCurrentModelSource('')
})

describe.each([false, true])('composer resume boundary (live menu: %s)', liveMenu => {
  it('keeps previews and late draft updates out until the resumed slice arrives', () => {
    $selectedStoredSessionId.set('stored-session')
    mountPill(liveMenu)
    expectPendingModel()

    act(() => applyStoredSessionPreviewRuntimeInfo({ model: 'preview-old-model' }, 'stored-session'))
    expectPendingModel()
    expect(screen.queryByText(/preview-old-model/)).toBeNull()

    act(() => {
      setCurrentModel('late-draft-model')
      setCurrentProvider('draft-provider')
    })
    expectPendingModel()
    expect(screen.queryByText(/late-draft-model/)).toBeNull()

    act(() => {
      $activeSessionId.set('runtime-session')
      publishSessionState('runtime-session', {
        ...createClientSessionState('stored-session'),
        model: resumedModel,
        provider: 'zai'
      })
    })
    expect(screen.getByText(formatModelPillLabel(resumedModel))).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  })

  it('clears the draft label when selecting stored history and restores it on return', () => {
    mountPill(liveMenu)
    expect(screen.getByText(formatModelPillLabel(rememberedModel))).toBeTruthy()

    act(() => $selectedStoredSessionId.set('stored-session'))
    expectPendingModel()

    act(() => $selectedStoredSessionId.set(null))
    expect(screen.getByText(formatModelPillLabel(rememberedModel))).toBeTruthy()
    expect(screen.getByTestId('model-pinned-dot')).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  })
})
