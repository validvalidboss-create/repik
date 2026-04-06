"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Camera, CameraOff, MessageSquare, MessageSquareOff, Mic, MicOff, Minimize2, MonitorUp, MonitorX, Wrench, X } from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type RemoteTrack,
} from "livekit-client";
import ChatPanel from "@/components/ChatPanel";
import ReviewForm from "@/components/ReviewForm";

export default function LessonPage() {
  const params = useParams<{ locale: string; bookingId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [status, setStatus] = useState<string>("initial");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [bookingTime, setBookingTime] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [lessonTime, setLessonTime] = useState<{ startedAt: string | null; endedAt: string | null } | null>(null);
  const [isTutor, setIsTutor] = useState<boolean>(false);
  const [remoteCount, setRemoteCount] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [issueOpen, setIssueOpen] = useState<boolean>(false);
  const [issueType, setIssueType] = useState<string>("TUTOR_NO_SHOW");
  const [issueMsg, setIssueMsg] = useState<string>("");
  const [issueSending, setIssueSending] = useState<boolean>(false);
  const [issueSent, setIssueSent] = useState<boolean>(false);
  const [issueOutcome, setIssueOutcome] = useState<string>("");
  const [issueErr, setIssueErr] = useState<string>("");

  const [devFastForwardBusy, setDevFastForwardBusy] = useState<boolean>(false);

  const userImage = (session?.user as any)?.image ? String((session?.user as any).image) : "";
  const userName = (session?.user as any)?.name ? String((session?.user as any).name) : "";
  const userInitials = useMemo(() => {
    const parts = String(userName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts[1]?.[0] || "";
    const s = `${a}${b}`.toUpperCase();
    return s || "U";
  }, [userName]);

  type PostLessonStep = "choice" | "builder" | "thanks";
  type HomeworkItem = { subject: string; topics: string[] };
  const [postLessonStep, setPostLessonStep] = useState<PostLessonStep>("choice");
  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>([{ subject: "", topics: [] }]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pipWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingPipRef = useRef<boolean>(false);
  const dragMovedRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const remoteAudioTrackRef = useRef<RemoteTrack | null>(null);

  const localPreviewStreamRef = useRef<MediaStream | null>(null);
  const localPreviewAudioStreamRef = useRef<MediaStream | null>(null);

  const [screenEnabled, setScreenEnabled] = useState<boolean>(false);
  const [swapVideo, setSwapVideo] = useState<boolean>(false);
  const [selfFullscreen, setSelfFullscreen] = useState<boolean>(false);
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pipDragging, setPipDragging] = useState<boolean>(false);

  const autoConfirmTriedRef = useRef<boolean>(false);

  const fullscreenPipRef = useRef<HTMLDivElement | null>(null);
  const draggingFullscreenPipRef = useRef<boolean>(false);
  const fullscreenPipMovedRef = useRef<boolean>(false);
  const fullscreenPipOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [fullscreenPipPos, setFullscreenPipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fullscreenPipDragging, setFullscreenPipDragging] = useState<boolean>(false);

  const isSwapped = swapVideo && remoteCount > 0;

  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [camEnabled, setCamEnabled] = useState<boolean>(false);
  const [joined, setJoined] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [hasLocalPreview, setHasLocalPreview] = useState<boolean>(false);

  const hasRoom = !!room;
  const canToggleRoomTracks = hasRoom && status === "connected";
  const localMode = !canToggleRoomTracks;
  const canToggleLocalCam = localMode || canToggleRoomTracks;

  useEffect(() => {
    if (!localMode) return;
    if (!camEnabled) return;
    if (!localPreviewStreamRef.current) return;

    const el = localVideoRef.current;
    if (!el) return;

    try {
      const cur = (el as any).srcObject as MediaStream | null;
      if (cur !== localPreviewStreamRef.current) {
        (el as any).srcObject = localPreviewStreamRef.current;
      }
      el.muted = true;
      (el as any).playsInline = true;
      void el.play?.();
    } catch {
      // ignore
    }
  }, [camEnabled, localMode, remoteCount, selfFullscreen, isSwapped, hasLocalPreview]);

  const LESSON_DURATION_SEC = 60 * 60;
  const LESSON_GRACE_SEC = 5 * 60;
  const lessonStartMs = useMemo(() => {
    const started = lessonTime?.startedAt ? new Date(lessonTime.startedAt).getTime() : NaN;
    if (!Number.isNaN(started)) return started;
    const booked = bookingTime?.startsAt ? new Date(bookingTime.startsAt).getTime() : NaN;
    if (!Number.isNaN(booked)) return booked;
    return NaN;
  }, [lessonTime?.startedAt, bookingTime?.startsAt]);

  const elapsedSec = useMemo(() => {
    if (!lessonStartMs || Number.isNaN(lessonStartMs)) return 0;
    return Math.max(0, Math.floor((nowMs - lessonStartMs) / 1000));
  }, [lessonStartMs, nowMs]);

  const remainingSec = useMemo(() => {
    if (!lessonStartMs || Number.isNaN(lessonStartMs)) return LESSON_DURATION_SEC;
    const elapsed = Math.floor((nowMs - lessonStartMs) / 1000);
    return Math.max(0, LESSON_DURATION_SEC - Math.max(0, elapsed));
  }, [lessonStartMs, nowMs]);

  const lessonTimeUp = remainingSec <= 0;

  const hardEndInSec = useMemo(() => {
    const max = LESSON_DURATION_SEC + LESSON_GRACE_SEC;
    return Math.max(0, max - elapsedSec);
  }, [elapsedSec]);

  const inOvertime = elapsedSec >= LESSON_DURATION_SEC;
  const hardEnded = inOvertime && hardEndInSec <= 0;

  const [dismissedEndSoon, setDismissedEndSoon] = useState<boolean>(false);

  const requestFullscreen = async () => {
    try {
      const el: any = document.documentElement;
      if (document.fullscreenElement) {
        await (document as any).exitFullscreen?.();
        return;
      }
      await el?.requestFullscreen?.();
    } catch {
      // ignore
    }
  };

  const devFastForward = async () => {
    if (devFastForwardBusy) return;
    setDevFastForwardBusy(true);
    setIssueErr("");
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(String(params.bookingId))}/dev-fast-forward`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося"));
      try {
        window.location.reload();
      } catch {
        window.location.href = window.location.href;
      }
    } catch (e) {
      setIssueErr(e instanceof Error ? e.message : "Не вдалося");
    } finally {
      setDevFastForwardBusy(false);
    }
  };

  const endConference = async () => {
    try {
      await fetch(`/api/bookings/${params.bookingId}/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
    } catch {
      // ignore
    }
  };

  const identity = useMemo(() => {
    const u = session?.user as any;
    return u?.id ? String(u.id) : undefined;
  }, [session?.user]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const el = pipWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.floor(window.innerWidth - rect.width - 16));
      const y = 16;
      setPipPos((p) => (p.x === 0 && p.y === 0 ? { x, y } : p));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!selfFullscreen) return;
    const id = window.requestAnimationFrame(() => {
      const el = fullscreenPipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.floor(window.innerWidth - rect.width - 16));
      const y = 16;
      setFullscreenPipPos((p) => (p.x === 0 && p.y === 0 ? { x, y } : p));
    });
    return () => window.cancelAnimationFrame(id);
  }, [selfFullscreen]);

  useEffect(() => {
    (async () => {
      if (!identity) {
        setStatus("auth");
        return;
      }
      setStatus("preparing");

      const gate = await fetch(`/api/bookings/${params.bookingId}`);
      if (!gate.ok) {
        setError("Access denied or booking not found");
        setStatus("error");
        return;
      }
      const gateData = await gate.json();
      const initialStatus = String(gateData.booking?.status || "");
      setBookingStatus(initialStatus);
      setIsTutor(!!gateData?.isTutor);
      if (gateData?.booking?.startsAt && gateData?.booking?.endsAt) {
        setBookingTime({ startsAt: String(gateData.booking.startsAt), endsAt: String(gateData.booking.endsAt) });
      }
      setLessonTime({
        startedAt: gateData?.booking?.startedAt ? String(gateData.booking.startedAt) : null,
        endedAt: gateData?.booking?.endedAt ? String(gateData.booking.endedAt) : null,
      });

      if (!autoConfirmTriedRef.current && initialStatus === "PENDING") {
        autoConfirmTriedRef.current = true;
        try {
          await fetch(`/api/bookings/${encodeURIComponent(String(params.bookingId))}/confirm-after-payment`, {
            method: "POST",
          });
          const r2 = await fetch(`/api/bookings/${encodeURIComponent(String(params.bookingId))}`, { cache: "no-store" });
          const d2 = await r2.json().catch(() => null);
          if (r2.ok) {
            setBookingStatus(String(d2?.booking?.status || initialStatus));
            setLessonTime({
              startedAt: d2?.booking?.startedAt ? String(d2.booking.startedAt) : null,
              endedAt: d2?.booking?.endedAt ? String(d2.booking.endedAt) : null,
            });
          }
        } catch {
          // ignore
        }
      }
    })();
  }, [identity, params.bookingId]);

  useEffect(() => {
    if (!identity) return;
    let alive = true;

    const tick = async () => {
      try {
        const r = await fetch(`/api/bookings/${params.bookingId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        setBookingStatus(String(d.booking?.status || ""));
        setLessonTime({
          startedAt: d?.booking?.startedAt ? String(d.booking.startedAt) : null,
          endedAt: d?.booking?.endedAt ? String(d.booking.endedAt) : null,
        });
      } catch {
        // ignore
      }
    };

    const id = window.setInterval(tick, 5000);
    tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [identity, params.bookingId]);

  const toggleScreenShare = async () => {
    const next = !screenEnabled;
    setScreenEnabled(next);

    if (!localMode) return;

    if (!next) {
      try {
        localPreviewStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {
        // ignore
      }
      localPreviewStreamRef.current = null;
      try {
        if (localVideoRef.current) (localVideoRef.current as any).srcObject = null;
      } catch {
        // ignore
      }
      setCamEnabled(false);
      return;
    }

    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia?.({ video: true, audio: false });
      if (!stream) throw new Error("Screen share not available");
      localPreviewStreamRef.current = stream as MediaStream;
      setCamEnabled(true);
      setHasLocalPreview(true);
      try {
        const [track] = (stream as MediaStream).getVideoTracks();
        if (track) {
          track.onended = () => {
            try {
              setScreenEnabled(false);
              setCamEnabled(false);
              localPreviewStreamRef.current = null;
              if (localVideoRef.current) (localVideoRef.current as any).srcObject = null;
            } catch {
              // ignore
            }
          };
        }
      } catch {
        // ignore
      }
      try {
        if (localVideoRef.current) {
          (localVideoRef.current as any).srcObject = stream;
          await localVideoRef.current.play();
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setError((e as Error)?.message || "Screen share permission denied");
      setScreenEnabled(false);
    }
  };

  useEffect(() => {
    if (!lessonTime?.endedAt) return;
    try {
      room?.disconnect();
    } catch {
      // ignore
    }
    setJoined(false);
    setStatus("lesson_ended");
  }, [lessonTime?.endedAt, room]);

  useEffect(() => {
    if (!bookingTime?.startsAt || !bookingTime?.endsAt) return;
    if (lessonTime?.endedAt) {
      setStatus("lesson_ended");
      return;
    }

    const startsAtMs = new Date(bookingTime.startsAt).getTime();
    const endsAtMs = new Date(bookingTime.endsAt).getTime();
    const openAt = startsAtMs - 20 * 60 * 1000;

    if (nowMs < openAt) {
      setStatus("too_early");
      return;
    }

    if (!room && status !== "connected") {
      setStatus("ready");
    }
  }, [bookingTime?.startsAt, bookingTime?.endsAt, nowMs, room, status]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!identity) return;
      if (!bookingTime?.startsAt || !bookingTime?.endsAt) return;
      if (room) return;
      if (lessonTime?.endedAt) return;

      const startsAtMs = new Date(bookingTime.startsAt).getTime();
      const endsAtMs = new Date(bookingTime.endsAt).getTime();
      const openAt = startsAtMs - 20 * 60 * 1000;
      void endsAtMs;
      if (nowMs < openAt) return;

      try {
        const tokenRes = await fetch(`/api/livekit/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: params.bookingId }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
          if (tokenRes.status === 423) {
            setStatus("too_early");
            return;
          }
          if (tokenRes.status === 410) {
            setStatus("lesson_ended");
            return;
          }
          throw new Error(tokenData?.error || "Token error");
        }
        if (!tokenData?.token || !tokenData?.url) {
          setError("LiveKit not configured");
          setStatus("not_configured");
          try {
            (room as any)?.disconnect?.();
          } catch {
            // ignore
          }
          setRoom(null);
          return;
        }

        const r = new Room();
        setRoom(r);
        r.on(RoomEvent.Disconnected, () => setStatus("disconnected"));
        r.on(RoomEvent.ConnectionStateChanged, (state) => setStatus(state));
        const updateRemote = () => setRemoteCount(r.remoteParticipants.size);
        r.on(RoomEvent.ParticipantConnected, updateRemote);
        r.on(RoomEvent.ParticipantDisconnected, updateRemote);

        const attachTrack = (track: RemoteTrack, el: HTMLMediaElement | null) => {
          if (!el) return;
          try {
            (track as any).attach(el);
          } catch {
            // ignore
          }
        };

        const detachTrack = (track: RemoteTrack, el: HTMLMediaElement | null) => {
          if (!el) return;
          try {
            (track as any).detach(el);
          } catch {
            // ignore
          }
        };

        r.on(RoomEvent.TrackSubscribed, (track) => {
          if ((track as any).kind === Track.Kind.Video) {
            remoteVideoTrackRef.current = track;
            attachTrack(track, remoteVideoRef.current);
          }
          if ((track as any).kind === Track.Kind.Audio) {
            remoteAudioTrackRef.current = track;
            attachTrack(track, remoteAudioRef.current);
          }
        });

        r.on(RoomEvent.TrackUnsubscribed, (track) => {
          if ((track as any).kind === Track.Kind.Video) {
            detachTrack(track, remoteVideoRef.current);
            remoteVideoTrackRef.current = null;
          }
          if ((track as any).kind === Track.Kind.Audio) {
            detachTrack(track, remoteAudioRef.current);
            remoteAudioTrackRef.current = null;
          }
        });

        const mic = await createLocalAudioTrack();
        const cam = await createLocalVideoTrack();

        localAudioTrackRef.current = mic;
        localVideoTrackRef.current = cam;
        setHasLocalPreview(true);

        try {
          if (localVideoRef.current) cam.attach(localVideoRef.current);
        } catch {
          // ignore
        }

        await r.connect(tokenData.url, tokenData.token, { autoSubscribe: true });

        await r.localParticipant.publishTrack(mic);
        await r.localParticipant.publishTrack(cam);

        setStatus("connected");
        setJoined(true);
        setMicEnabled(true);
        setCamEnabled(true);
        updateRemote();
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        room?.disconnect();
      } catch {
        // ignore
      }

      try {
        const vt = localVideoTrackRef.current;
        if (vt && localVideoRef.current) vt.detach(localVideoRef.current);
        vt?.stop();
      } catch {
        // ignore
      }
      try {
        localAudioTrackRef.current?.stop();
      } catch {
        // ignore
      }

      localVideoTrackRef.current = null;
      localAudioTrackRef.current = null;
      remoteVideoTrackRef.current = null;
      remoteAudioTrackRef.current = null;
      if (cancelled) setJoined(false);
    };
  }, [identity, bookingTime?.startsAt, bookingTime?.endsAt, params.bookingId, nowMs, room, lessonTime?.endedAt]);

  useEffect(() => {
    if (status !== "not_configured") return;
    setJoined(true);
  }, [status]);

  useEffect(() => {
    if (status === "not_configured") {
      setCamEnabled(false);
      setMicEnabled(false);
    }
  }, [status]);

  const toggleCamera = async () => {
    const next = !camEnabled;
    setCamEnabled(next);

    if (localMode) {
      if (!next) {
        try {
          localPreviewStreamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {
          // ignore
        }
        localPreviewStreamRef.current = null;
        try {
          if (localVideoRef.current) (localVideoRef.current as any).srcObject = null;
        } catch {
          // ignore
        }
        setHasLocalPreview(false);
        return;
      }

      if (!localPreviewStreamRef.current) {
        try {
          if (!navigator?.mediaDevices?.getUserMedia) {
            setError("getUserMedia is not available in this browser");
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localPreviewStreamRef.current = stream;
          setHasLocalPreview(true);
        } catch (e) {
          setError((e as Error)?.message || "Camera permission denied");
          return;
        }
      }

      try {
        if (localVideoRef.current) {
          (localVideoRef.current as any).srcObject = localPreviewStreamRef.current;
          try {
            localVideoRef.current.muted = true;
            (localVideoRef.current as any).playsInline = true;
          } catch {
            // ignore
          }
          try {
            await localVideoRef.current.play();
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      setJoined(true);
      return;
    }

    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(next);
    } catch {
      // ignore
    }
  };

  const toggleMic = async () => {
    const next = !micEnabled;
    setMicEnabled(next);

    if (localMode) {
      if (!next) {
        try {
          localPreviewAudioStreamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {
          // ignore
        }
        localPreviewAudioStreamRef.current = null;
        return;
      }

      if (!localPreviewAudioStreamRef.current) {
        try {
          if (!navigator?.mediaDevices?.getUserMedia) {
            setError("getUserMedia is not available in this browser");
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          localPreviewAudioStreamRef.current = stream;
        } catch (e) {
          setError((e as Error)?.message || "Microphone permission denied");
          return;
        }
      }
      return;
    }

    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
    } catch {
      // ignore
    }
  };

  const startsAt = bookingTime?.startsAt ? new Date(bookingTime.startsAt).getTime() : 0;
  const endsAt = bookingTime?.endsAt ? new Date(bookingTime.endsAt).getTime() : 0;
  const openAt = startsAt ? startsAt - 20 * 60 * 1000 : 0;
  const secondsToOpen = openAt ? Math.max(0, Math.floor((openAt - nowMs) / 1000)) : 0;
  const secondsToStart = startsAt ? Math.max(0, Math.floor((startsAt - nowMs) / 1000)) : 0;
  const secondsToEnd = endsAt ? Math.max(0, Math.floor((endsAt - nowMs) / 1000)) : 0;
  const endSoonWarning = secondsToEnd > 0 && secondsToEnd <= 5 * 60;
  const graceRemainingSec = secondsToEnd <= 0 ? Math.max(0, LESSON_GRACE_SEC + secondsToEnd) : 0;
  const inGrace = secondsToEnd <= 0 && graceRemainingSec > 0;
  const graceEnded = secondsToEnd <= 0 && graceRemainingSec <= 0;

  const feedbackAvailable = !!endsAt && nowMs >= endsAt + 60 * 60 * 1000;
  const feedbackInSec = endsAt ? Math.max(0, Math.floor((endsAt + 60 * 60 * 1000 - nowMs) / 1000)) : 0;

  const submitIssue = async () => {
    if (issueSending) return;
    setIssueSending(true);
    setIssueErr("");
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(String(params.bookingId))}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: issueType, message: issueMsg }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося надіслати"));
      setIssueOutcome(String(data?.outcome || ""));
      setIssueSent(true);
      setIssueOpen(false);
      setIssueMsg("");
    } catch (e) {
      setIssueErr(e instanceof Error ? e.message : "Не вдалося надіслати");
    } finally {
      setIssueSending(false);
    }
  };

  const [showEndSoonWarning, setShowEndSoonWarning] = useState<boolean>(false);
  const [showTimeEndedToast, setShowTimeEndedToast] = useState<boolean>(false);
  const timeEndedShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!endSoonWarning) return;
    if (dismissedEndSoon) return;
    setShowEndSoonWarning(true);
  }, [dismissedEndSoon, endSoonWarning]);

  useEffect(() => {
    if (!endsAt) return;
    if (lessonTime?.endedAt) return;
    if (secondsToEnd > 0) return;
    if (timeEndedShownRef.current) return;
    timeEndedShownRef.current = true;
    setShowTimeEndedToast(true);
    const t = window.setTimeout(() => setShowTimeEndedToast(false), 8000);
    return () => window.clearTimeout(t);
  }, [endsAt, lessonTime?.endedAt, secondsToEnd]);

  const mm = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const homeworkCatalog = useMemo(() => {
    const catalog: Record<string, string[]> = {
      english: ["Grammar", "Vocabulary", "Listening", "Speaking", "Reading", "Writing", "Exam prep"],
      math: ["Algebra", "Geometry", "Functions", "Equations", "Fractions", "Word problems"],
      ukrainian: ["Spelling", "Punctuation", "Reading", "Essay"],
      german: ["Grammar", "Vocabulary", "Listening", "Speaking"],
      polish: ["Grammar", "Vocabulary", "Listening", "Speaking"],
      physics: ["Mechanics", "Electricity", "Optics"],
    };
    return catalog;
  }, []);

  const hwStorageKey = useMemo(() => `repetitir:hw:${String(params.bookingId || "")}`, [params.bookingId]);

  useEffect(() => {
    if (status !== "lesson_ended") return;
    if (!isTutor) return;
    try {
      const raw = localStorage.getItem(hwStorageKey);
      if (!raw) {
        setPostLessonStep("choice");
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setHomeworkItems(
          parsed.items.map((x: any) => ({ subject: String(x?.subject || ""), topics: Array.isArray(x?.topics) ? x.topics.map(String) : [] })),
        );
        setPostLessonStep("thanks");
        return;
      }
      setPostLessonStep("choice");
    } catch {
      setPostLessonStep("choice");
    }
  }, [hwStorageKey, isTutor, status]);

  const payoutText = useMemo(() => {
    try {
      const rawStatus = String(bookingStatus || "");
      if (rawStatus !== "CONFIRMED" && rawStatus !== "COMPLETED") return null;
      return "Гроші за урок зараховано на баланс.";
    } catch {
      return "Гроші за урок зараховано на баланс.";
    }
  }, [bookingStatus]);

  const fmtCountdown = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.ceil((s % 3600) / 60);
    if (h <= 0) return `${m} хв`;
    if (m <= 0) return `${h} год`;
    return `${h} год ${m} хв`;
  };

  const fmtStartsAt = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d.toLocaleString();
    }
  };

  if (status === "auth") return <main className="mx-auto max-w-5xl px-4 py-16">Будь ласка, увійдіть, щоб приєднатися до уроку.</main>;
  if (status === "too_early")
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            aria-label="Закрити"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            onClick={() => {
              const href = `/${params.locale}/dashboard?tab=lessons#schedule`;
              try {
                window.location.href = href;
              } catch {
                try {
                  window.location.assign(href);
                } catch {
                  // ignore
                }
              }
            }}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-2xl font-semibold text-neutral-900">Урок заплановано</div>
          <div className="mt-2 text-sm text-neutral-600">
            Вхід до кімнати відкривається за 20 хвилин до початку уроку.
          </div>

          {bookingTime?.startsAt ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs text-neutral-500">Початок уроку</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{fmtStartsAt(bookingTime.startsAt)}</div>
              {openAt ? (
                <div className="mt-2 text-sm text-neutral-700">
                  Доступ відкриється через <span className="font-semibold">{fmtCountdown(secondsToOpen)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                const href = `/${params.locale}/dashboard?tab=lessons#schedule`;
                try {
                  window.location.href = href;
                } catch {
                  try {
                    window.location.assign(href);
                  } catch {
                    // ignore
                  }
                }
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              До розкладу
            </button>
            <button
              type="button"
              onClick={() => {
                const href = `/${params.locale}/chat/${encodeURIComponent(String(params.bookingId))}`;
                try {
                  window.location.href = href;
                } catch {
                  try {
                    window.location.assign(href);
                  } catch {
                    // ignore
                  }
                }
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Відкрити чат
            </button>
          </div>
        </div>
      </main>
    );

  if (status === "lesson_ended")
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        {isTutor ? (
          <div className="mx-auto w-full max-w-[720px]">
            {postLessonStep === "choice" ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="text-2xl font-semibold text-neutral-900">Урок завершено</div>
                <div className="mt-2 text-sm text-neutral-600">Хочете задати домашнє завдання учню?</div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <div className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-black shadow">
                      скоро
                    </div>
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-amber-400 bg-white px-5 text-sm font-semibold text-neutral-900 opacity-80"
                      title="Функція в розробці"
                    >
                      Задати домашнє
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPostLessonStep("thanks")}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Пропустити
                  </button>
                </div>
              </div>
            ) : null}

            {postLessonStep === "builder" ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="text-2xl font-semibold text-neutral-900">Домашнє завдання</div>
                <div className="mt-2 text-sm text-neutral-600">Оберіть предмет і теми — ми сформуємо список завдань для учня.</div>

                <div className="mt-6 space-y-6">
                  {homeworkItems.map((it, idx) => {
                    const topics = it.subject ? homeworkCatalog[it.subject] || [] : [];
                    const selected = new Set(it.topics);
                    return (
                      <div key={`hw-${idx}`} className="rounded-xl border border-neutral-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-neutral-900">Предмет {idx + 1}</div>
                          {homeworkItems.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setHomeworkItems((arr) => arr.filter((_, i) => i !== idx).map((x) => ({ subject: x.subject, topics: x.topics })))
                              }
                              className="text-sm text-neutral-600 hover:underline"
                            >
                              Видалити
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-3">
                          <label className="text-xs text-neutral-600">Предмет</label>
                          <select
                            className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                            value={it.subject}
                            onChange={(e) => {
                              const v = String(e.target.value || "");
                              setHomeworkItems((arr) =>
                                arr.map((x, i) => (i === idx ? { subject: v, topics: [] } : { subject: x.subject, topics: x.topics })),
                              );
                            }}
                          >
                            <option value="">Оберіть…</option>
                            {Object.keys(homeworkCatalog).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs text-neutral-600">Теми</div>
                          {topics.length === 0 ? (
                            <div className="mt-2 text-sm text-neutral-500">Оберіть предмет, щоб побачити теми.</div>
                          ) : (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {topics.map((t) => {
                                const checked = selected.has(t);
                                return (
                                  <label key={t} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = new Set(selected);
                                        if (e.target.checked) next.add(t);
                                        else next.delete(t);
                                        setHomeworkItems((arr) =>
                                          arr.map((x, i) =>
                                            i === idx ? { subject: x.subject, topics: Array.from(next) } : { subject: x.subject, topics: x.topics },
                                          ),
                                        );
                                      }}
                                    />
                                    <span className="text-neutral-900">{t}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHomeworkItems((arr) => [...arr, { subject: "", topics: [] }])}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Додати предмет
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setPostLessonStep("choice")}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const cleaned = homeworkItems
                          .map((x) => ({ subject: String(x.subject || ""), topics: Array.isArray(x.topics) ? x.topics.map(String) : [] }))
                          .filter((x) => x.subject && x.topics.length > 0);
                        localStorage.setItem(hwStorageKey, JSON.stringify({ bookingId: params.bookingId, items: cleaned, createdAt: new Date().toISOString() }));
                      } catch {
                        // ignore
                      }
                      setPostLessonStep("thanks");
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Надіслати
                  </button>
                </div>
              </div>
            ) : null}

            {postLessonStep === "thanks" ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="text-2xl font-semibold text-neutral-900">Дякуємо за проведений урок</div>
                <div className="mt-2 text-sm text-neutral-600">
                  {payoutText || "Дані про виплату будуть оновлені у вашому балансі найближчим часом."}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/${params.locale}/dashboard`)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    До розкладу
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/${params.locale}/chat/${encodeURIComponent(String(params.bookingId))}`)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Відкрити чат
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-2">Урок</h1>
            <div className="text-sm text-neutral-600">Урок завершено.</div>

            {bookingStatus === "MISSED_TRIAL" ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Пробний урок позначено як пропущений (студент не прийшов).
              </div>
            ) : null}

            {issueSent ? (
              issueOutcome === "COUNTED_FOR_TUTOR" ? (
                <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
                  Нам прикро, що ви не змогли приєднатись. У цьому випадку урок зараховується на користь викладача.
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Дякуємо! Ми отримали повідомлення про проблему. Менеджер перевірить ситуацію, а урок тимчасово буде на розгляді.
                </div>
              )
            ) : null}

            {!feedbackAvailable ? (
              <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                Оцінка та повідомлення про проблему будуть доступні через {Math.ceil(feedbackInSec / 60)} хв.
              </div>
            ) : bookingStatus === "DISPUTED" && issueOutcome !== "COUNTED_FOR_TUTOR" ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Урок на розгляді. Ми повідомимо вас після перевірки.
              </div>
            ) : (bookingStatus === "CONFIRMED" || bookingStatus === "COMPLETED") ? (
              <div className="mt-6">
                <ReviewForm bookingId={params.bookingId} />
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueErr("");
                      setIssueOpen(true);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Повідомити про проблему
                  </button>
                </div>
              </div>
            ) : null}

            {issueErr ? <div className="mt-4 text-sm text-red-700">{issueErr}</div> : null}

            {process.env.NODE_ENV !== "production" && !isTutor ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={devFastForwardBusy}
                  onClick={() => void devFastForward()}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {devFastForwardBusy ? "DEV: ..." : "DEV: зробити урок завершеним 2 год тому"}
                </button>
              </div>
            ) : null}

            {issueOpen ? (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => {
                    if (issueSending) return;
                    setIssueOpen(false);
                  }}
                />
                <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-neutral-900">Повідомити про проблему</div>
                      <div className="mt-1 text-sm text-neutral-600">Ми передамо звернення менеджеру і перевіримо ситуацію.</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      onClick={() => {
                        if (issueSending) return;
                        setIssueOpen(false);
                      }}
                      aria-label="Закрити"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-neutral-600">Що сталося?</div>
                      <select
                        className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
                        value={issueType}
                        onChange={(e) => setIssueType(String(e.target.value || ""))}
                        disabled={issueSending}
                      >
                        <option value="TUTOR_NO_SHOW">Викладач не прийшов на урок</option>
                        <option value="STUDENT_COULD_NOT_JOIN">Я не зміг(ла) приєднатись</option>
                        <option value="TECHNICAL_PROBLEM">Технічна проблема (звук/відео/зв’язок)</option>
                        <option value="QUALITY_NOT_AS_EXPECTED">Урок не відповідав очікуванням</option>
                        <option value="OTHER">Інше</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-neutral-600">Коментар (необов’язково)</div>
                      <textarea
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 h-24"
                        value={issueMsg}
                        onChange={(e) => setIssueMsg(e.target.value)}
                        disabled={issueSending}
                        placeholder="Опишіть коротко, що сталося…"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                      type="button"
                      disabled={issueSending}
                      onClick={() => setIssueOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      disabled={issueSending}
                      onClick={() => void submitIssue()}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {issueSending ? "Надсилаємо…" : "Надіслати"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    );

  return (
    <main>
      <div className="fixed inset-0 z-40 bg-neutral-950 text-white">
        <div className={`pointer-events-none absolute inset-0 flex ${chatOpen ? "pr-0 lg:pr-[520px]" : "pr-0"}`}>
          <div className="relative flex-1">
            <div className="absolute inset-0 bg-black pointer-events-none">
              {remoteCount > 0 ? (
                <video
                  ref={isSwapped ? localVideoRef : remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={isSwapped}
                  onDoubleClick={() => void requestFullscreen()}
                  className="absolute inset-0 h-full w-full object-cover opacity-100"
                />
              ) : selfFullscreen ? (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    onDoubleClick={() => void requestFullscreen()}
                    className="absolute inset-0 h-full w-full object-cover opacity-100"
                  />
                  {!camEnabled || (localMode && camEnabled && !localPreviewStreamRef.current) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <div className="h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/10 flex items-center justify-center text-xl font-semibold text-white/90">
                        {userImage ? <img src={userImage} alt="" className="h-full w-full object-cover" /> : userInitials}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-lg font-semibold">
                      {isTutor ? "T" : "S"}
                    </div>
                    <div className="text-xl sm:text-2xl font-semibold">Тут відбудеться ваш урок</div>
                    {bookingTime?.startsAt ? (
                      <div className="mt-2 text-sm text-white/70">Заплановано на {new Date(bookingTime.startsAt).toLocaleString()}</div>
                    ) : (
                      <div className="mt-2 text-sm text-white/70">Очікування підключення…</div>
                    )}
                    <div className="mt-3 text-sm text-white/70">{isTutor ? "Очікуємо учня" : "Очікуємо викладача"}</div>
                  </div>
                </div>
              )}

              <audio ref={remoteAudioRef} autoPlay />

              {!selfFullscreen ? (
                <div
                  ref={pipWrapRef}
                  className={`pointer-events-auto absolute left-0 top-0 w-[170px] sm:w-[220px] aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl ${pipDragging ? "cursor-grabbing" : "cursor-grab"}`}
                  style={{ transform: `translate3d(${pipPos.x}px, ${pipPos.y}px, 0)` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragMovedRef.current = false;
                    draggingPipRef.current = true;
                    setPipDragging(true);
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    dragOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
                    try {
                      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                    } catch {
                      // ignore
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!draggingPipRef.current) return;
                    const el = pipWrapRef.current;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const w = rect.width;
                    const h = rect.height;
                    const nx = Math.floor(e.clientX - dragOffsetRef.current.dx);
                    const ny = Math.floor(e.clientY - dragOffsetRef.current.dy);
                    const x = Math.max(0, Math.min(window.innerWidth - w, nx));
                    const y = Math.max(0, Math.min(window.innerHeight - h, ny));
                    dragMovedRef.current = true;
                    setPipPos({ x, y });
                  }}
                  onPointerUp={() => {
                    if (!draggingPipRef.current) return;
                    draggingPipRef.current = false;
                    setPipDragging(false);
                    if (!dragMovedRef.current) {
                      if (remoteCount > 0) setSwapVideo((v) => !v);
                    }
                  }}
                  onPointerCancel={() => {
                    draggingPipRef.current = false;
                    setPipDragging(false);
                  }}
                >
                  <video
                    ref={remoteCount > 0 ? (isSwapped ? remoteVideoRef : localVideoRef) : localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    onDoubleClick={() => {
                      if (remoteCount > 0) void requestFullscreen();
                    }}
                    className="h-full w-full object-cover"
                  />

                  {!camEnabled || (localMode && camEnabled && !localPreviewStreamRef.current) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/10 flex items-center justify-center text-sm font-semibold text-white/90">
                        {userImage ? <img src={userImage} alt="" className="h-full w-full object-cover" /> : userInitials}
                      </div>
                    </div>
                  ) : null}

                  <div className="pointer-events-none absolute inset-0">
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="pointer-events-none absolute left-2 top-2 text-[11px] text-white/90 select-none">Drag</div>
                    <button
                      type="button"
                      className="pointer-events-auto absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white/90 backdrop-blur"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (remoteCount > 0) setSwapVideo((v) => !v);
                        else setSelfFullscreen(true);
                      }}
                    >
                      Розгорнути
                    </button>
                  </div>

                  {localMode && camEnabled && !localPreviewStreamRef.current ? (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
                      Немає доступу до камери
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div
                    ref={fullscreenPipRef}
                    className={`pointer-events-auto absolute left-0 top-0 w-[170px] sm:w-[220px] aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl ${fullscreenPipDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{ transform: `translate3d(${fullscreenPipPos.x}px, ${fullscreenPipPos.y}px, 0)` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      fullscreenPipMovedRef.current = false;
                      draggingFullscreenPipRef.current = true;
                      setFullscreenPipDragging(true);
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      fullscreenPipOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
                      try {
                        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                      } catch {
                        // ignore
                      }
                    }}
                    onPointerMove={(e) => {
                      if (!draggingFullscreenPipRef.current) return;
                      const el = fullscreenPipRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const w = rect.width;
                      const h = rect.height;
                      const nx = Math.floor(e.clientX - fullscreenPipOffsetRef.current.dx);
                      const ny = Math.floor(e.clientY - fullscreenPipOffsetRef.current.dy);
                      const x = Math.max(0, Math.min(window.innerWidth - w, nx));
                      const y = Math.max(0, Math.min(window.innerHeight - h, ny));
                      fullscreenPipMovedRef.current = true;
                      setFullscreenPipPos({ x, y });
                    }}
                    onPointerUp={() => {
                      if (!draggingFullscreenPipRef.current) return;
                      draggingFullscreenPipRef.current = false;
                      setFullscreenPipDragging(false);
                      if (!fullscreenPipMovedRef.current) {
                        setSelfFullscreen(false);
                      }
                    }}
                    onPointerCancel={() => {
                      draggingFullscreenPipRef.current = false;
                      setFullscreenPipDragging(false);
                    }}
                    role="button"
                    aria-label="Повернути вікно"
                    title="Повернути"
                  >
                    {remoteCount > 0 ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/10 flex items-center justify-center text-sm font-semibold text-white/90">
                          {userImage ? <img src={userImage} alt="" className="h-full w-full object-cover" /> : userInitials}
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0">
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="pointer-events-none absolute left-2 top-2 text-[11px] text-white/90 select-none">Drag</div>
                      <button
                        type="button"
                        className="pointer-events-auto absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white/90 backdrop-blur"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelfFullscreen(false);
                        }}
                        aria-label="Згорнути"
                        title="Згорнути"
                      >
                        Згорнути
                      </button>
                    </div>
                  </div>
                </>
              )}

              {status === "connected" && remoteCount === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  {isTutor ? "Учень ще не приєднався" : "Викладач ще не приєднався"}
                </div>
              ) : null}

              <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs text-white/90 backdrop-blur">
                {startsAt && nowMs < startsAt ? (
                  <span>Залишилось {mm(secondsToStart)}</span>
                ) : endsAt && nowMs <= endsAt ? (
                  <span>Залишилось {mm(secondsToEnd)}</span>
                ) : inGrace ? (
                  <span className="inline-flex flex-col items-start">
                    <span className="font-semibold">Урок завершено</span>
                    <span className="text-white/80">Конференція завершиться через {mm(graceRemainingSec)}</span>
                  </span>
                ) : (
                  <span>Залишилось 0:00</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`pointer-events-auto absolute right-0 top-0 z-[9999] h-full w-[420px] sm:w-[480px] lg:w-[520px] max-w-[92vw] border-l border-white/10 bg-neutral-950/95 backdrop-blur transition-transform duration-200 ${
            chatOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ transform: chatOpen ? "translateX(0)" : "translateX(100%)" }}
          onPointerDownCapture={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="h-full overflow-hidden pointer-events-auto">
            <div className="h-full overflow-auto p-3 pointer-events-auto">
              <ChatPanel key={`${params.bookingId}:${chatOpen ? "open" : "closed"}`} bookingId={params.bookingId} theme="dark" />
            </div>
          </div>
        </div>

        <div
          className="fixed left-0 right-0 z-[9999] flex justify-center px-4"
          style={
            {
              bottom: "24px",
              top: "auto",
              paddingBottom: "env(safe-area-inset-bottom)",
              pointerEvents: "auto",
            } as any
          }
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur" style={{ pointerEvents: "auto" }}>
            <button
              type="button"
              disabled={!canToggleLocalCam}
              onClick={() => void toggleCamera()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 pointer-events-auto"
              aria-label="Camera"
              title="Camera"
            >
              {camEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled={status === "connected" ? !canToggleRoomTracks : false}
              onClick={() => void toggleMic()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 pointer-events-auto"
              aria-label="Microphone"
              title="Microphone"
            >
              {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 pointer-events-auto"
              aria-label="Chat"
              title="Chat"
            >
              {chatOpen ? <MessageSquareOff className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled={!localMode}
              onClick={() => void toggleScreenShare()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 pointer-events-auto"
              aria-label="Screen share"
              title="Screen share"
            >
              {screenEnabled ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-50 pointer-events-auto"
              aria-label="Інструмент"
              title="Скоро"
            >
              <Wrench className="h-5 w-5" />
            </button>

            {isTutor && lessonTimeUp ? (
              <button
                type="button"
                onClick={() => void endConference()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600/90 px-4 text-sm font-semibold text-white hover:bg-red-600"
              >
                Закончить
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => router.push(`/${params.locale}/dashboard`)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              Выйти
            </button>
          </div>
        </div>

        {!!error ||
        (showTimeEndedToast && !lessonTime?.endedAt) ||
        inGrace ||
        (showEndSoonWarning && !dismissedEndSoon) ||
        hardEnded ||
        (graceEnded && !lessonTime?.endedAt) ? (
          <div className="pointer-events-none absolute bottom-24 left-0 right-0 z-50 flex justify-center px-4">
            <div className="flex w-full max-w-[420px] flex-col items-center gap-2 px-2">
              {showTimeEndedToast && !lessonTime?.endedAt ? (
                <div className="pointer-events-auto w-full rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-50 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-center w-full">
                      <div className="font-semibold">Урок завершено</div>
                      <div className="mt-0.5 text-emerald-50/90">Можна попрощатися та завершити зустріч</div>
                    </div>
                    <button
                      type="button"
                      className="pointer-events-auto inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTimeEndedToast(false);
                      }}
                      aria-label="Закрити"
                      title="Закрити"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {hardEnded ? (
                <div className="pointer-events-auto w-full rounded-full border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/90 backdrop-blur text-center">
                  Час уроку закінчено. Дякуємо!
                </div>
              ) : null}

              {graceEnded && !lessonTime?.endedAt ? (
                <div className="pointer-events-auto w-full rounded-full border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/90 backdrop-blur text-center">
                  Додатковий час завершено. Будь ласка, завершіть урок.
                </div>
              ) : null}

              {showEndSoonWarning && !dismissedEndSoon ? (
                <div className="pointer-events-auto relative w-full rounded-full border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/90 backdrop-blur">
                  <div className="text-center">Через 5 хв закінчується урок</div>
                  <button
                    type="button"
                    className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedEndSoon(true);
                      setShowEndSoonWarning(false);
                    }}
                    aria-label="Закрити"
                    title="Закрити"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="pointer-events-auto w-full rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 text-sm text-red-100 backdrop-blur">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

      </div>
    </main>
  );
}
