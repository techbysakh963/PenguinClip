import { SetupWizard } from './components/SetupWizard'
import './index.css'
import { invoke } from '@tauri-apps/api/core'

export function SetupApp() {
  const handleComplete = async () => {
    try {
      await invoke('finish_setup')
    } catch (err) {
      console.error('Failed to finish setup:', err)
      if (typeof window !== 'undefined') {
        alert('Failed to finish setup. Please try again or check the logs for details.')
      }
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <SetupWizard onComplete={handleComplete} />
    </div>
  )
}
