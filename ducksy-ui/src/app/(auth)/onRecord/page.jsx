'use client'

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Square, Pause, Play, Mic, Monitor, Camera, Home, ChevronDown, ChevronUp, X, Loader2, RefreshCw, CalendarPlus, Check, Plus, Calendar, Sparkles, Upload, Volume2, VolumeX } from "lucide-react"

import { useRecorder } from "@/hooks/useRecorder"
import SessionChat from "@/components/SessionChat"
import MediaPreview from "@/components/MediaPreview"
import ThinkingIndicator from "@/components/ThinkingIndicator"
import { useSettings } from "@/hooks/SettingsContext"
import { useSearchParams } from "next/navigation"

export default function OnRecordPage() {
      const { t } = useSettings()
      const [recordTime, setRecordTime] = useState({ time: 0, formatted: "00:00" })
      const [isPaused, setIsPaused] = useState(false)
      const [isRecording, setIsRecording] = useState(false)
      const [expanded, setExpanded] = useState(false)
      const [transcriptionResult, setTranscriptionResult] = useState(null)
      const [isProcessing, setIsProcessing] = useState(false)
      const [deviceId, setDeviceId] = useState(null)
      const [capturedFile, setCapturedFile] = useState(null)
      const [showCalendarModal, setShowCalendarModal] = useState(false)
      const [calendarLoading, setCalendarLoading] = useState(false)
      const [calendarSuccess, setCalendarSuccess] = useState(false)
      const [eventDate, setEventDate] = useState('')
      const [eventTime, setEventTime] = useState('')
      const [isDragging, setIsDragging] = useState(false)
      const [waveHistory, setWaveHistory] = useState(Array(18).fill(0.15))
      const lastUpdateRef = useRef(0)

      useEffect(() => {
            if (!isRecording) {
                  setWaveHistory(Array(18).fill(0.15))
                  return
            }

            let audioContext
            let analyser
            let source
            let animationFrameId
            let stream

            const setupAudio = async () => {
                  try {
                        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                        const AudioContext = window.AudioContext || window.webkitAudioContext
                        audioContext = new AudioContext()
                        analyser = audioContext.createAnalyser()
                        analyser.fftSize = 64
                        
                        source = audioContext.createMediaStreamSource(stream)
                        source.connect(analyser)

                        const dataArray = new Uint8Array(analyser.frequencyBinCount)
                        
                        const updateVolume = () => {
                              if (analyser) {
                                    analyser.getByteFrequencyData(dataArray)
                                    let sum = 0
                                    for (let i = 0; i < dataArray.length; i++) {
                                          sum += dataArray[i]
                                    }
                                    const average = sum / dataArray.length
                                    const normalized = Math.min(average / 120, 1)
                                    
                                    const now = Date.now()
                                    // Throttle updating the sliding wave to every 80ms to create a smooth scrolling effect
                                    if (now - lastUpdateRef.current > 80) {
                                          if (!recorderIsPaused) {
                                                setWaveHistory(prev => {
                                                      const next = [...prev.slice(1), Math.max(0.15, normalized)]
                                                      return next
                                                })
                                                lastUpdateRef.current = now
                                          }
                                    }
                              }
                              animationFrameId = requestAnimationFrame(updateVolume)
                        }

                        updateVolume()
                  } catch (err) {
                        console.error("Failed to setup audio visualizer:", err)
                  }
            }

            setupAudio()

            return () => {
                  if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId)
                  }
                  if (source) source.disconnect()
                  if (audioContext && audioContext.state !== 'closed') {
                        audioContext.close()
                  }
                  if (stream) {
                        stream.getTracks().forEach(track => track.stop())
                  }
            }
      }, [isRecording])

      const {
            isRecording: recorderIsRecording,
            isPaused: recorderIsPaused,
            formattedDuration,
            startRecording,
            pauseRecording,
            resumeRecording,
            stopRecording,
            audioBlob,
            saveRecording,
            resetRecording,
            micVolume,
            systemVolume,
            setMicVolume,
            setSystemVolume,
            supportsSystemAudio,
            duration,
      } = useRecorder()

      useEffect(() => {
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.invoke("set-mic-front").then((d) => {
                        setDeviceId(d)
                        console.log(d)
                  })
            }
      }, [])

      // Declarative window resizer based on active states (statically expanded notch)
      useEffect(() => {
            if (typeof window === 'undefined' || !window.electron) return

            let targetWidth = 432
            let targetHeight = 40

            if (transcriptionResult) {
                  targetHeight = expanded ? 600 : 40
                  targetWidth = 482
            } else if (isProcessing) {
                  targetHeight = 120
                  targetWidth = 432
            } else {
                  targetHeight = 40
                  targetWidth = 432
            }

            window.electron.send('resize-recording-window', { width: targetWidth, height: targetHeight })
      }, [transcriptionResult, isProcessing, expanded])

      useEffect(() => {
            if (!audioBlob) return

            // Minimum 3 seconds duration check
            if (duration < 3) {
                  console.log("Recording less than 3 seconds, discarding.")
                  resetRecording()
                  return
            }

            const save = async () => {
                  const result = await saveRecording()
                  if (result?.success) {
                        console.log("Audio saved:", result.filePath)
                  }
                  resetRecording()
            }

            save()
      }, [audioBlob, saveRecording, resetRecording])

      const handleTranscriptionUpdate = async (data) => {
            console.log('Transcription update:', data)

            let parsedData = { ...data }
            if (parsedData.details && typeof parsedData.details === 'string') {
                  try {
                        parsedData.details = JSON.parse(parsedData.details)
                  } catch (e) {
                        console.error('Failed to parse details:', e)
                        parsedData.details = {}
                  }
            }

            if (parsedData.status === 'completed') {
                  // Validated: Fetch full session details to ensure we have everything
                  if (typeof window !== 'undefined' && window.electron) {
                        try {
                              const result = await window.electron.invoke('get-session', { fileId: parsedData.fileId || parsedData.id })
                              if (result.success && result.data) {
                                    console.log("Refetched full session:", result.data)
                                    parsedData = { ...result.data }
                              }
                        } catch (e) {
                              console.error("Failed to refetch session:", e)
                        }
                  }

                  setTranscriptionResult(parsedData)
                  setIsProcessing(false)
                  setExpanded(true)
                  if (typeof window !== 'undefined' && window.electron) {
                        window.electron.send('resize-recording-window', { height: 600 })
                  }
            } else if (parsedData.status === 'failed') {
                  setTranscriptionResult(parsedData)
                  setIsProcessing(false)

                  // Auto-retry on "Resource exhausted" (429) error
                  const errorMsg = parsedData.error || '';
                  if (errorMsg.includes("Resource exhausted") || errorMsg.includes("429")) {
                        console.log("Resource exhausted error detected. Auto-retrying in 3s...");
                        const retryFileId = parsedData.fileId || parsedData.id;
                        if (retryFileId && typeof window !== 'undefined' && window.electron) {
                              setTimeout(async () => {
                                    setIsProcessing(true);
                                    try {
                                          const result = await window.electron.invoke('retry-transcription', {
                                                fileId: retryFileId
                                          });
                                          if (!result.success) {
                                                console.error("Auto-retry failed:", result.error);
                                          }
                                    } catch (e) {
                                          console.error("Auto-retry error:", e);
                                          setIsProcessing(false);
                                    }
                              }, 3000);
                        }
                  }
            } else {
                  setIsProcessing(true)
            }
      }

      useEffect(() => {
            const checkLatestFile = async () => {
                  if (typeof window !== 'undefined' && window.electron) {
                        try {
                              const result = await window.electron.invoke('get-latest-file')
                              if (result && result.success && result.data) {
                                    console.log('Found latest file on mount:', result.data)

                                    if (result.data.filePath && result.data.mimeType) {
                                          setCapturedFile({
                                                filePath: result.data.filePath,
                                                mimeType: result.data.mimeType
                                          })
                                    }

                                    handleTranscriptionUpdate({
                                          fileId: result.data.fileId,
                                          status: result.data.transcriptionStatus,
                                          title: result.data.title,
                                          details: result.data.details,
                                          chatHistory: result.data.chatHistory,
                                          calendarEvent: result.data.calendarEvent
                                    })
                              }
                        } catch (e) {
                              console.error("Failed to check latest file:", e)
                        }
                  }
            }

            checkLatestFile()
      }, [])

      useEffect(() => {
            document.body.style.backgroundColor = 'transparent'
            document.documentElement.style.backgroundColor = 'transparent'

            if (typeof window === 'undefined' || !window.electron) return

            const handleTimeUpdate = (data) => {
                  setRecordTime({
                        time: data.time,
                        formatted: data.formatted
                  })
                  setIsRecording(true)
            }

            const handlePausedState = (data) => {
                  setIsPaused(data.isPaused)
            }

            const handleRecordingControl = (data) => {
                  if (data.action === 'stop') {
                        setIsRecording(false)
                        setRecordTime({ time: 0, formatted: "00:00" })
                  }
            }

            const handleRecordingSaved = async (data) => {
                  console.log('Recording saved:', data)
                  if (data.filePath) {
                        try {
                              const result = await window.electron.invoke('get-latest-file')
                              if (result && result.success && result.data) {
                                    setCapturedFile({
                                          filePath: result.data.filePath,
                                          mimeType: result.data.mimeType
                                    })
                              }
                        } catch (e) {
                              console.error("Failed to get file info:", e)
                        }
                  }
                  setIsProcessing(true)
                  setExpanded(true)
                  window.electron.send('resize-recording-window', { height: 600 })
            }

            window.electron.receive('update-record-time', handleTimeUpdate)
            window.electron.receive('recording-paused-state', handlePausedState)
            window.electron.receive('recording-control-update', handleRecordingControl)
            window.electron.receive('transcription-updated', handleTranscriptionUpdate)
            window.electron.receive('recording-saved', handleRecordingSaved)

            return () => {
                  if (window.electron.removeListener) {
                        window.electron.removeListener('update-record-time', handleTimeUpdate)
                        window.electron.removeListener('recording-paused-state', handlePausedState)
                        window.electron.removeListener('recording-control-update', handleRecordingControl)
                        window.electron.removeListener('transcription-updated', handleTranscriptionUpdate)
                        window.electron.removeListener('recording-saved', handleRecordingSaved)
                  }
            }
      }, [])

      useEffect(() => {
            setIsRecording(recorderIsRecording)
            setIsPaused(recorderIsPaused)
            if (recorderIsRecording) {
                  setRecordTime({ time: 0, formatted: formattedDuration })
            }
      }, [recorderIsRecording, recorderIsPaused, formattedDuration])

      const handleStop = async () => {
            stopRecording()
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('recording-control', { action: 'stop' })
            }

            // Check duration (use local formattedDuration or track separate start time if needed, 
            // but here we use the hook's duration state which should be accurate enough for seconds)
            if (duration < 3) {
                  console.log("Recording skipped: < 3s")
                  return
            }

            setIsProcessing(true)
            setExpanded(true)
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('resize-recording-window', { height: 600 })
            }
      }

      const handlePauseResume = () => {
            if (isPaused) {
                  resumeRecording()
            } else {
                  pauseRecording()
            }
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('recording-control', { action: 'pause' })
            }
      }

      const handleVoiceClick = async () => {
            console.log("Record By : " + deviceId)
            await startRecording(deviceId)
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('record-audio', { action: 'start' })
            }
      }

      const handleScreenClick = () => {
            console.log('Screen share clicked')
      }

      const handleCameraClick = () => {
            console.log('Camera clicked - activating magic lens')
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('activate-magic-lens')
            }
      }

      const handleReturnToDashboard = () => {
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('close-overlay')
            }
      }

      const handleRetry = async () => {
            if (!transcriptionResult?.fileId) return

            setIsProcessing(true)
            if (typeof window !== 'undefined' && window.electron) {
                  try {
                        const result = await window.electron.invoke('retry-transcription', {
                              fileId: transcriptionResult.fileId
                        })
                        if (!result.success) {
                              console.error("Retry failed:", result.error)
                              setIsProcessing(false)
                        }
                  } catch (e) {
                        console.error("Retry error:", e)
                        setIsProcessing(false)
                  }
            }
      }

      const toggleExpand = () => {
            const newExpanded = !expanded
            setExpanded(newExpanded)
            if (typeof window !== 'undefined' && window.electron) {
                  window.electron.send('resize-recording-window', { height: newExpanded ? 600 : 250 })
            }
      }

      const handleDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            const files = e.dataTransfer.files;
            if (files.length === 0) return;

            const file = files[0];
            const mimeType = file.type;

            // Check if audio or image
            const isAudio = mimeType.startsWith('audio/');
            const isImage = mimeType.startsWith('image/');

            if (!isAudio && !isImage) {
                  console.warn('Unsupported file type:', mimeType);
                  return;
            }

            setIsProcessing(true);

            try {
                  // Read file as ArrayBuffer and convert to base64 (chunked to avoid stack overflow)
                  const arrayBuffer = await file.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);
                  let binary = '';
                  const chunkSize = 8192;
                  for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.subarray(i, i + chunkSize);
                        binary += String.fromCharCode.apply(null, chunk);
                  }
                  const base64 = btoa(binary);

                  // Get settings from localStorage
                  const storedSettings = localStorage.getItem('ducksy-settings');
                  const settings = storedSettings ? JSON.parse(storedSettings) : {};

                  if (typeof window !== 'undefined' && window.electron) {
                        if (isAudio) {
                              const result = await window.electron.invoke('save-audio-file', {
                                    audioData: base64,
                                    mimeType: mimeType,
                                    settings: settings
                              });
                              console.log('Audio file saved:', result);
                        } else if (isImage) {
                              const result = await window.electron.invoke('save-image-file', {
                                    buffer: base64,
                                    mimeType: mimeType,
                                    settings: settings
                              });
                              console.log('Image file saved:', result);
                        }
                  }
            } catch (err) {
                  console.error('Error processing dropped file:', err);
                  setIsProcessing(false);
            }
      };

      const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
      };

      const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
      };
      const renderWaveform = () => {
            return (
                  <div className="flex items-center gap-[2.5px] h-5 justify-center overflow-hidden">
                        {waveHistory.map((val, i) => {
                              const maxPossibleHeight = 18
                              // smooth scaling calculation based on value in the sliding history array
                              const height = Math.max(3, val * maxPossibleHeight)
                              
                              return (
                                    <motion.div
                                          key={i}
                                          animate={{ height }}
                                          transition={{ type: "spring", stiffness: 350, damping: 20 }}
                                          className={`w-[4px] rounded-full ${
                                                 i % 2 === 0 ? (recorderIsPaused ? 'bg-gray-500' : 'bg-amber-500') : (recorderIsPaused ? 'bg-gray-500' : 'bg-red-500')
                                           }`}
                                    />
                              )
                        })}
                  </div>
            )
      }

      return (
            <div
                  className="h-full w-full flex flex-col items-center justify-start p-0 bg-transparent overflow-visible"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
            >
                  {/* Drag overlay */}
                  <AnimatePresence>
                        {isDragging && (
                              <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm border-2 border-dashed border-amber-500/50 rounded-b-[24px]"
                              >
                                    <div className="flex flex-col items-center gap-3">
                                          <Upload className="w-12 h-12 text-amber-500" />
                                          <p className="text-white font-medium">Drop audio or image file</p>
                                          <p className="text-neutral-400 text-sm">Supports audio & image files</p>
                                    </div>
                              </motion.div>
                        )}
                  </AnimatePresence>
                  
                  {/* Camera Notch Container */}
                  <motion.div
                        animate={{ y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="w-full max-w-[400px] select-none shrink-0 z-50 overflow-visible"
                  >
                        <div className="relative w-full h-[40px] bg-black rounded-b-[20px] shadow-2xl flex items-center pt-[2px] justify-between px-3 select-none">
                              {/* Left curved transition corner */}
                              <svg className="absolute top-0 right-full w-4 h-4 text-black fill-current pointer-events-none" viewBox="0 0 16 16">
                                    <path d="M16,16 L16,0 L0,0 C8.83,0 16,7.17 16,16 Z" />
                              </svg>

                              {/* Right curved transition corner */}
                              <svg className="absolute top-0 left-full w-4 h-4 text-black fill-current pointer-events-none" viewBox="0 0 16 16">
                                    <path d="M0,16 L0,0 L16,0 C7.17,0 0,7.17 0,16 Z" />
                              </svg>

                              {isRecording ? (
                                    <>
                                          {/* Total Recording Time on the left */}
                                          <div className="flex items-center pl-1.5">
                                                <span className="text-xs font-mono font-bold text-neutral-400 tabular-nums select-none">{formattedDuration}</span>
                                          </div>

                                          {/* Moving Audio Wave in the center */}
                                          <div className="flex-1 flex justify-center items-center px-4">
                                                {renderWaveform()}
                                          </div>

                                          {/* Stop and Pause controls on the right */}
                                          <div className="flex items-center gap-1.5 pr-1">
                                                {/* Pause/Resume Button */}
                                                <motion.button
                                                      whileHover={{ scale: 1.08 }}
                                                      whileTap={{ scale: 0.92 }}
                                                      onClick={handlePauseResume}
                                                      className="w-7 h-7 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all non-draggable"
                                                      title={isPaused ? "Resume" : "Pause"}
                                                >
                                                      {isPaused ? (
                                                            <Play className="w-2.5 h-2.5 fill-white" strokeWidth={0} />
                                                      ) : (
                                                            <Pause className="w-2.5 h-2.5 text-white" strokeWidth={2} />
                                                      )}
                                                </motion.button>

                                                {/* Stop Button */}
                                                <motion.button
                                                      whileHover={{ scale: 1.08 }}
                                                      whileTap={{ scale: 0.92 }}
                                                      onClick={handleStop}
                                                      className="w-7 h-7 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 flex items-center justify-center text-red-400 hover:text-red-300 transition-all non-draggable"
                                                      title="Stop"
                                                >
                                                      <Square className="w-2.5 h-2.5 fill-red-400" strokeWidth={0} />
                                                </motion.button>
                                          </div>
                                    </>
                              ) : (
                                    <>
                                          {/* App Logo on the left */}
                                          <div className="flex items-center pl-1">
                                                <span className="text-sm select-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">🦆</span>
                                          </div>

                                          {/* Action Buttons on the right */}
                                          <div className="flex items-center gap-1.5 pr-1">
                                                {/* Screenshot Button */}
                                                <motion.button
                                                      whileHover={{ scale: 1.08 }}
                                                      whileTap={{ scale: 0.92 }}
                                                      onClick={handleCameraClick}
                                                      className="w-7 h-7 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all group non-draggable"
                                                      title="Screenshot"
                                                >
                                                      <Camera className="w-3.5 h-3.5" strokeWidth={2} />
                                                </motion.button>

                                                {/* Voice Recording Button */}
                                                <motion.button
                                                      whileHover={{ scale: 1.08 }}
                                                      whileTap={{ scale: 0.92 }}
                                                      onClick={handleVoiceClick}
                                                      className="w-7 h-7 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/5 flex items-center justify-center text-neutral-400 hover:text-amber-500 transition-all group non-draggable"
                                                      title="Record Voice"
                                                >
                                                      <Mic className="w-3.5 h-3.5" strokeWidth={2} />
                                                </motion.button>

                                                {/* Return to Dashboard Button */}
                                                <motion.button
                                                      whileHover={{ scale: 1.08 }}
                                                      whileTap={{ scale: 0.92 }}
                                                      onClick={handleReturnToDashboard}
                                                      className="w-7 h-7 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all group non-draggable"
                                                      title="Return to Dashboard"
                                                >
                                                      <Home className="w-3.5 h-3.5" strokeWidth={2} />
                                                </motion.button>
                                          </div>
                                    </>
                              )}
                        </div>
                  </motion.div>



                  <AnimatePresence>
                        {expanded && (isProcessing || transcriptionResult) && (
                              <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="w-full max-w-xs mt-4 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                              >
                                    {isProcessing ? (
                                          <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex flex-col items-center p-6"
                                          >
                                                {capturedFile?.mimeType?.startsWith('image') && (
                                                      <div className="w-full mb-4 rounded-xl overflow-hidden border border-white/10">
                                                            <MediaPreview
                                                                  filePath={capturedFile.filePath}
                                                                  mimeType={capturedFile.mimeType}
                                                                  duration={0}
                                                            />
                                                      </div>
                                                )}



                                                <ThinkingIndicator type={capturedFile?.mimeType?.startsWith('image') ? 'image' : 'audio'} />
                                          </motion.div>
                                    ) : transcriptionResult?.status === 'failed' ? (
                                          <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex flex-col items-center justify-center p-8 h-[250px]"
                                          >
                                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                                      <X className="w-6 h-6 text-red-500" />
                                                </div>
                                                <p className="text-sm font-medium text-white mb-1">{t.error || "Analysis Failed"}</p>
                                                <p className="text-xs text-neutral-500 text-center px-4 mb-6">
                                                      {transcriptionResult.error || "Something went wrong during analysis."}
                                                </p>

                                                <motion.button
                                                      whileHover={{ scale: 1.05 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      onClick={handleRetry}
                                                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors"
                                                >
                                                      <RefreshCw className="w-4 h-4" />
                                                      Retry Analysis
                                                </motion.button>
                                          </motion.div>
                                    ) : transcriptionResult ? (
                                          <motion.div
                                                key={transcriptionResult.fileId || transcriptionResult.id || 'result'}
                                                initial="hidden"
                                                animate="visible"
                                                variants={{
                                                      hidden: { opacity: 0 },
                                                      visible: {
                                                            opacity: 1,
                                                            transition: {
                                                                  staggerChildren: 0.1
                                                            }
                                                      }
                                                }}
                                                className="flex flex-col h-full"
                                          >
                                                <div className="p-6 border-b border-white/5 flex items-start justify-between bg-neutral-900/30">
                                                      <div>
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 text-neutral-400 border border-white/5">
                                                                        {transcriptionResult.mode || "lens"}
                                                                  </span>
                                                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                                        {transcriptionResult.type || "summary"}
                                                                  </span>
                                                            </div>
                                                            <h2 className="text-xl font-bold text-white leading-tight">{transcriptionResult.title}</h2>
                                                            <p className="text-xs text-neutral-500 mt-1">{t.session.summary} • Now</p>
                                                      </div>
                                                      <button
                                                            onClick={toggleExpand}
                                                            className="p-2 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                                                      >
                                                            <ChevronUp className="w-5 h-5" />
                                                      </button>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar max-h-[400px]">
                                                      {transcriptionResult.details?.topic && (
                                                            <motion.div
                                                                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                                                  className="space-y-2"
                                                            >
                                                                  <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{t.dashboardPage?.meetingTopic || "Meeting Topic"}</h3>
                                                                  <p className="text-sm text-neutral-300 leading-relaxed bg-white/2 p-3 rounded-xl border border-white/5">
                                                                        {transcriptionResult.details.topic}
                                                                  </p>
                                                            </motion.div>
                                                      )}

                                                      {transcriptionResult.details?.summary && (
                                                            <motion.div
                                                                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                                                  className="space-y-2"
                                                            >
                                                                  <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{t.dashboardPage?.summary || "Summary"}</h3>
                                                                  <p className="text-sm text-neutral-300 leading-relaxed">
                                                                        {transcriptionResult.details.summary}
                                                                  </p>
                                                            </motion.div>
                                                      )}

                                                      {transcriptionResult.details?.actionItems && transcriptionResult.details.actionItems.length > 0 && (
                                                            <motion.div
                                                                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                                                  className="space-y-2"
                                                            >
                                                                  <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{t.dashboardPage?.actionItems || "Action Items"}</h3>
                                                                  <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                                        <ul className="space-y-2">
                                                                              {
                                                                                    (() => {
                                                                                          const items = transcriptionResult.details.actionItems || [];
                                                                                          const sortedItems = [...items].sort((a, b) => {
                                                                                                const getStatus = (item) => {
                                                                                                      const isPast = item.calendarEvent?.dateTime && new Date(item.calendarEvent.dateTime) < new Date();
                                                                                                      const isDismissed = item.dismissed;
                                                                                                      // 0: Active/Pending, 1: Inactive (Dismissed/Past)
                                                                                                      return (isDismissed || isPast) ? 1 : 0;
                                                                                                };

                                                                                                const statusA = getStatus(a);
                                                                                                const statusB = getStatus(b);

                                                                                                if (statusA !== statusB) return statusA - statusB;

                                                                                                // Secondary sort: Date (Ascending)
                                                                                                const dateA = a.calendarEvent?.dateTime ? new Date(a.calendarEvent.dateTime) : new Date(8640000000000000); // No date = far future
                                                                                                const dateB = b.calendarEvent?.dateTime ? new Date(b.calendarEvent.dateTime) : new Date(8640000000000000);
                                                                                                return dateA - dateB;
                                                                                          });

                                                                                          return sortedItems.map((item, i) => {
                                                                                                // Note: 'i' here is the index in the SORTED list. 
                                                                                                // We need to find the ORIGINAL index for callbacks if they rely on index.
                                                                                                const originalIndex = items.indexOf(item);

                                                                                                const isObject = typeof item === 'object' && item !== null;
                                                                                                const text = isObject ? (item.text || item.description || "") : String(item);
                                                                                                const tool = isObject ? item.tool : null;
                                                                                                const params = isObject ? item.parameters : {};

                                                                                                const isPast = item.calendarEvent?.dateTime && new Date(item.calendarEvent.dateTime) < new Date();
                                                                                                const isInactive = item?.dismissed || isPast;

                                                                                                return (
                                                                                                      <motion.li
                                                                                                            key={originalIndex}
                                                                                                            variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                                                                                                            className={`flex items-start justify-between gap-4 text-sm text-neutral-300 bg-white/2 p-3 rounded-xl border border-white/5 transition-colors group/item ${isInactive ? 'opacity-50' : 'hover:bg-white/5'}`}
                                                                                                      >
                                                                                                            <div className="flex items-start gap-3 flex-1">
                                                                                                                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                                                                  <div className="flex flex-col gap-1">
                                                                                                                        {isObject && item.type === 'event' && (
                                                                                                                              <div className="flex items-center gap-1.5 text-amber-500/80 mb-0.5">
                                                                                                                                    <Calendar className="w-3 h-3" />
                                                                                                                                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Event</span>
                                                                                                                              </div>
                                                                                                                        )}
                                                                                                                        <p className={`leading-relaxed ${isInactive ? 'line-through' : ''}`}>{text}</p>
                                                                                                                  </div>
                                                                                                            </div>

                                                                                                            <div className="flex gap-2 shrink-0 mt-0.5">
                                                                                                                  <button
                                                                                                                        onClick={(e) => {
                                                                                                                              e.stopPropagation()
                                                                                                                              if (item?.confirmed || isInactive) return;

                                                                                                                              let eventData = {};

                                                                                                                              // Use the specific calendar event data if available on the item
                                                                                                                              if (item.calendarEvent) {
                                                                                                                                    eventData = {
                                                                                                                                          ...item.calendarEvent,
                                                                                                                                          detected: true
                                                                                                                                    };
                                                                                                                              } else {
                                                                                                                                    // Fallback default: 1 hour from now
                                                                                                                                    const now = new Date()
                                                                                                                                    now.setHours(now.getHours() + 1)
                                                                                                                                    eventData = {
                                                                                                                                          title: text,
                                                                                                                                          description: `Action item from session: ${transcriptionResult.title}`,
                                                                                                                                          dateTime: now.toISOString(),
                                                                                                                                          detected: true
                                                                                                                                    };
                                                                                                                              }

                                                                                                                              // Reuse existing dashboard logic for calendar if needed, or just open the modal with this data
                                                                                                                              setEventDate(eventData.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0]);
                                                                                                                              setEventTime(eventData.dateTime?.split('T')[1]?.substring(0, 5) || '12:00');
                                                                                                                              setShowCalendarModal(true);
                                                                                                                        }}
                                                                                                                        disabled={item?.confirmed || isInactive}
                                                                                                                        title={item?.confirmed ? "Confirmed" : item?.dismissed ? "Rejected" : isPast ? "Past Event" : "Add to Calendar"}
                                                                                                                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all ${item?.confirmed
                                                                                                                              ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                                                                                                              : isInactive
                                                                                                                                    ? 'bg-neutral-800/50 border-neutral-800 text-neutral-600 cursor-not-allowed'
                                                                                                                                    : 'bg-transparent border-neutral-600 text-neutral-400 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/10'
                                                                                                                              }`}
                                                                                                                  >
                                                                                                                        {item?.dismissed ? (
                                                                                                                              <X className="w-4 h-4" />
                                                                                                                        ) : (
                                                                                                                              <Plus className="w-4 h-4" strokeWidth={item?.confirmed ? 3 : 2} />
                                                                                                                        )}
                                                                                                                  </button>

                                                                                                                  <button
                                                                                                                        onClick={async (e) => {
                                                                                                                              e.stopPropagation();
                                                                                                                              if (item?.confirmed || isInactive) return;
                                                                                                                              if (window.electron) {
                                                                                                                                    await window.electron.invoke('calendar-dismiss-event', {
                                                                                                                                          fileId: transcriptionResult.fileId || transcriptionResult.id,
                                                                                                                                          index: originalIndex
                                                                                                                                    });
                                                                                                                              }
                                                                                                                        }}
                                                                                                                        disabled={item?.confirmed || isInactive}
                                                                                                                        title="Reject Suggestion"
                                                                                                                        className={`w-7 h-7 rounded-md border border-neutral-600 text-neutral-400 flex items-center justify-center transition-all ${isInactive ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'}`}
                                                                                                                  >
                                                                                                                        <X className="w-4 h-4" />
                                                                                                                  </button>

                                                                                                                  {tool && (
                                                                                                                        <button
                                                                                                                              onClick={(e) => {
                                                                                                                                    e.stopPropagation();
                                                                                                                                    if (window.electron) {
                                                                                                                                          window.electron.invoke('execute-tool', { tool, params })
                                                                                                                                                .then(res => {
                                                                                                                                                      if (res.success) alert("Action Executed!");
                                                                                                                                                      else alert("Error: " + res.error);
                                                                                                                                                });
                                                                                                                                    }
                                                                                                                              }}
                                                                                                                              className="h-7 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-medium rounded-md transition-colors border border-amber-500/20 flex items-center gap-2"
                                                                                                                        >
                                                                                                                              <Monitor className="w-3 h-3" />
                                                                                                                              Execute
                                                                                                                        </button>
                                                                                                                  )}
                                                                                                            </div>
                                                                                                      </motion.li>
                                                                                                );
                                                                                          });
                                                                                    })()
                                                                              }

                                                                        </ul>
                                                                  </div>
                                                            </motion.div>
                                                      )}
                                                      {transcriptionResult.details?.code && (
                                                            <motion.div
                                                                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                                                  className="space-y-2"
                                                            >
                                                                  <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{t.session.code}</h3>
                                                                  <div className="p-3 bg-black/30 rounded-xl border border-white/5 font-mono text-xs text-neutral-300 overflow-x-auto">
                                                                        <pre>{transcriptionResult.details.code}</pre>
                                                                  </div>
                                                            </motion.div>
                                                      )}


                                                      <div className="pt-4 border-t border-white/5">
                                                            <SessionChat
                                                                  fileId={transcriptionResult.fileId || transcriptionResult.id}
                                                                  initialHistory={transcriptionResult.chatHistory || []}
                                                            />
                                                      </div>
                                                </div>
                                                <div className="p-4 border-t border-white/5 bg-neutral-900/50 flex justify-between items-center gap-2">
                                                      <button
                                                            onClick={handleRetry}
                                                            className="flex items-center gap-2 px-3 py-2 bg-white/5 text-neutral-400 text-xs font-medium rounded-lg hover:bg-white/10 hover:text-white transition-colors border border-white/10"
                                                            title={t.dashboardPage?.regen || "Regenerate"}
                                                      >
                                                            <Sparkles className="w-4 h-4" />
                                                            {t.dashboardPage?.regen || "Re-gen"}
                                                      </button>

                                                      <button
                                                            onClick={() => {
                                                                  setTranscriptionResult(null);
                                                                  setCapturedFile(null);
                                                                  setIsProcessing(false);
                                                                  setExpanded(false);
                                                                  setRecordTime({ time: 0, formatted: "00:00" });
                                                                  if (typeof window !== 'undefined' && window.electron) {
                                                                        window.electron.send('resize-recording-window', { height: 250 });
                                                                  }
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-2 bg-white/5 text-neutral-400 text-xs font-medium rounded-lg hover:bg-white/10 hover:text-white transition-colors border border-white/10"
                                                            title="New Scan"
                                                      >
                                                            <Plus className="w-4 h-4" />
                                                            New Scan
                                                      </button>


                                                      <button
                                                            onClick={() => window.electron.send('close-overlay')}
                                                            className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-colors"
                                                      >
                                                            Done
                                                      </button>
                                                </div>

                                                {/* Calendar Modal */}
                                                <AnimatePresence>
                                                      {showCalendarModal && (
                                                            <motion.div
                                                                  initial={{ opacity: 0 }}
                                                                  animate={{ opacity: 1 }}
                                                                  exit={{ opacity: 0 }}
                                                                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                                                            >
                                                                  <motion.div
                                                                        initial={{ scale: 0.9, opacity: 0 }}
                                                                        animate={{ scale: 1, opacity: 1 }}
                                                                        exit={{ scale: 0.9, opacity: 0 }}
                                                                        className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full max-w-xs"
                                                                  >
                                                                        {calendarSuccess ? (
                                                                              <div className="text-center py-4">
                                                                                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                                                                                          <Check className="w-6 h-6 text-emerald-500" />
                                                                                    </div>
                                                                                    <p className="text-sm font-medium text-white mb-1">Event Added!</p>
                                                                                    <p className="text-xs text-neutral-500">Check your Google Calendar</p>
                                                                                    <button
                                                                                          onClick={() => {
                                                                                                setShowCalendarModal(false)
                                                                                                setCalendarSuccess(false)
                                                                                          }}
                                                                                          className="mt-4 px-4 py-2 bg-white text-black text-xs font-bold rounded-lg"
                                                                                    >
                                                                                          Close
                                                                                    </button>
                                                                              </div>
                                                                        ) : (
                                                                              <>
                                                                                    <h3 className="text-sm font-bold text-white mb-4">Add to Calendar</h3>

                                                                                    <div className="space-y-3">
                                                                                          <div>
                                                                                                <label className="block text-xs text-neutral-500 mb-1">Date</label>
                                                                                                <input
                                                                                                      type="date"
                                                                                                      value={eventDate}
                                                                                                      onChange={(e) => setEventDate(e.target.value)}
                                                                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                                                                                />
                                                                                          </div>
                                                                                          <div>
                                                                                                <label className="block text-xs text-neutral-500 mb-1">Time</label>
                                                                                                <input
                                                                                                      type="time"
                                                                                                      value={eventTime}
                                                                                                      onChange={(e) => setEventTime(e.target.value)}
                                                                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                                                                                />
                                                                                          </div>
                                                                                    </div>

                                                                                    <div className="flex gap-2 mt-4">
                                                                                          <button
                                                                                                onClick={() => setShowCalendarModal(false)}
                                                                                                className="flex-1 px-3 py-2 bg-white/5 text-neutral-400 text-xs font-medium rounded-lg hover:bg-white/10"
                                                                                          >
                                                                                                Cancel
                                                                                          </button>
                                                                                          <button
                                                                                                onClick={async () => {
                                                                                                      if (!eventDate || !eventTime) return
                                                                                                      setCalendarLoading(true)
                                                                                                      try {
                                                                                                            const startTime = new Date(`${eventDate}T${eventTime}`).toISOString()
                                                                                                            const endTime = new Date(new Date(`${eventDate}T${eventTime}`).getTime() + 60 * 60 * 1000).toISOString()

                                                                                                            const result = await window.electron.invoke('calendar-create-event', {
                                                                                                                  title: transcriptionResult?.title || 'New Event',
                                                                                                                  description: transcriptionResult?.details?.summary || '',
                                                                                                                  startTime,
                                                                                                                  endTime
                                                                                                            })

                                                                                                            if (result.success) {
                                                                                                                  setCalendarSuccess(true)
                                                                                                            } else {
                                                                                                                  alert(result.error || 'Failed to create event')
                                                                                                            }
                                                                                                      } catch (e) {
                                                                                                            console.error('Calendar error:', e)
                                                                                                            alert('Failed to create event')
                                                                                                      } finally {
                                                                                                            setCalendarLoading(false)
                                                                                                      }
                                                                                                }}
                                                                                                disabled={calendarLoading}
                                                                                                className="flex-1 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50"
                                                                                          >
                                                                                                {calendarLoading ? 'Adding...' : 'Add Event'}
                                                                                          </button>
                                                                                    </div>
                                                                              </>
                                                                        )}
                                                                  </motion.div>
                                                            </motion.div>
                                                      )}
                                                </AnimatePresence>
                                          </motion.div>
                                    ) : null}
                              </motion.div>
                        )}
                  </AnimatePresence >

            </div>
      )
}
