"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NextImage from "next/image";
import TutorScheduleSlotPicker, { slotSetToWindows, windowsToSlotSet } from "@/components/TutorScheduleSlotPicker";
import TimeZonePicker from "@/components/TimeZonePicker";

interface Tutor {
  id: string;
  userId: string;
  user?: { name?: string | null; email?: string | null };
  subjects: string[];
  bio?: string | null;
  headline?: string | null;
  rateCents: number;
  currency: string;
  tracks?: string[];
  videoUrl?: string | null;
  media?: string[];
  country?: string | null;
  languages?: string[];
  moderationNote?: string | null;
}

const COUNTRY_TO_NATIVE_LANG: Record<string, string> = {
  UA: "uk",
  PL: "pl",
  DE: "de",
  FR: "fr",
  IT: "it",
  ES: "es",
  GB: "en",
  US: "en",
  CA: "en",
};

type CertificationRow = {
  subject: string;
  certificate: string;
  description: string;
  issuedBy: string;
  fromYear: string;
  toYear: string;
  fileUrl?: string;
  fileName?: string;
};

export default function TeacherOnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [tutor, setTutor] = useState<Tutor | null>(null);

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [step1SubmitError, setStep1SubmitError] = useState<string>("");

  const firstNameRef = useRef<HTMLInputElement | null>(null);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const countryRef = useRef<HTMLSelectElement | null>(null);
  const firstSubjectRef = useRef<HTMLSelectElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const adultRef = useRef<HTMLInputElement | null>(null);

  const photoExamples = [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&h=256&q=80",
    "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=256&h=256&q=80",
  ];

  const yearOptions = ["", ...Array.from({ length: 60 }).map((_, i) => String(new Date().getFullYear() - i))];

  const photoRules = [
    "Дивіться прямо в камеру",
    "Обличчя і плечі — по центру кадру",
    "На фото має бути лише одна людина",
    "Кольорове фото високої якості, без фільтрів",
    "Без логотипів та контактної інформації",
  ];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("UA");
  const [adult, setAdult] = useState(false);
  const [langRows, setLangRows] = useState<{ code: string; level: string }[]>([
    { code: "", level: "b2" },
  ]);
  const [langTouched, setLangTouched] = useState(false);

  const [subjectRows, setSubjectRows] = useState<{ key: string; level: string }[]>([
    { key: "", level: "b2" },
  ]);

  const languageSubjectKeys = useMemo(
    () =>
      new Set([
        "english",
        "french",
        "german",
        "italian",
        "spanish",
        "polish",
        "ukrainian",
        "czech",
        "korean",
      ]),
    [],
  );

  const [subjects, setSubjects] = useState<string[]>([]);
  const [directionsBySubject, setDirectionsBySubject] = useState<Record<string, string[]>>({});
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState<string>("");
  const [rate30, setRate30] = useState<string>("");
  const [currency, setCurrency] = useState("UAH");
  const [experienceTag, setExperienceTag] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("");
  const [teacherType, setTeacherType] = useState<string>("");
  const [trialRate, setTrialRate] = useState<string>("");
  const [freeFirstLesson, setFreeFirstLesson] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [resume, setResume] = useState<string>("");
  const [resumeFileName, setResumeFileName] = useState<string>("");
  const [resumeUploading, setResumeUploading] = useState<boolean>(false);
  const [photoUploading, setPhotoUploading] = useState<boolean>(false);
  const [photoFileName, setPhotoFileName] = useState<string>("");

  const [step2SubmitError, setStep2SubmitError] = useState<string>("");

  const [profileIntro, setProfileIntro] = useState<string>("");
  const [profileExperience, setProfileExperience] = useState<string>("");
  const [profileMotivation, setProfileMotivation] = useState<string>("");

  const [descActiveSection, setDescActiveSection] = useState<1 | 2 | 3 | 4 | null>(1);
  const [descAccepted, setDescAccepted] = useState<{ intro: boolean; experience: boolean; motivate: boolean; headline: boolean }>({
    intro: false,
    experience: false,
    motivate: false,
    headline: false,
  });

  const [noTeachingCertificate, setNoTeachingCertificate] = useState(false);
  const [certRows, setCertRows] = useState<CertificationRow[]>([
    { subject: "", certificate: "", description: "", issuedBy: "", fromYear: "", toYear: "", fileUrl: "", fileName: "" },
  ]);

  const [certUploadingIndex, setCertUploadingIndex] = useState<number | null>(null);
  const [certUploadError, setCertUploadError] = useState<string>("");

  const [photoEditOpen, setPhotoEditOpen] = useState(false);
  const [photoEditFile, setPhotoEditFile] = useState<File | null>(null);
  const [photoEditZoom, setPhotoEditZoom] = useState(1.1);
  const [photoEditRotate, setPhotoEditRotate] = useState(0);
  const [photoEditOffset, setPhotoEditOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [photoEditDragging, setPhotoEditDragging] = useState(false);
  const photoEditDragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const photoEditCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const photoBlockRef = useRef<HTMLDivElement | null>(null);

  const [videoRecordOpen, setVideoRecordOpen] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoRecordError, setVideoRecordError] = useState<string>("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoStreamLoading, setVideoStreamLoading] = useState(false);
  const [videoHasStream, setVideoHasStream] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");
  const [hasRecordedVideo, setHasRecordedVideo] = useState(false);
  const [videoRecordSeconds, setVideoRecordSeconds] = useState(0);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [videoMinDurationError, setVideoMinDurationError] = useState<string>("");
  const [step7Error, setStep7Error] = useState<string>("");
  const recordedVideoBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [videoFileUploading, setVideoFileUploading] = useState(false);
  const [videoUploadHelpOpen, setVideoUploadHelpOpen] = useState(false);
  const videoRecordIntervalRef = useRef<number | null>(null);
  const VIDEO_MAX_SECONDS = 120;
  const VIDEO_MIN_SECONDS = 30;
  const VIDEO_MAX_BYTES = 60 * 1024 * 1024;

  async function getVideoDurationSecondsFromBlob(blob: Blob): Promise<number | null> {
    try {
      const url = URL.createObjectURL(blob);
      try {
        const v = document.createElement("video");
        v.preload = "metadata";
        return await new Promise<number | null>((resolve) => {
          const cleanup = () => {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
          };
          v.onloadedmetadata = () => {
            const d = Number.isFinite(v.duration) ? v.duration : NaN;
            cleanup();
            resolve(Number.isFinite(d) ? Math.round(d) : null);
          };
          v.onerror = () => {
            cleanup();
            resolve(null);
          };
          v.src = url;
        });
      } catch {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
        return null;
      }
    } catch {
      return null;
    }
  }

  const photoEditUrl = useMemo(() => {
    if (!photoEditFile) return "";
    return URL.createObjectURL(photoEditFile);
  }, [photoEditFile]);

  useEffect(() => {
    if (!photoEditUrl) return;
    return () => {
      try {
        URL.revokeObjectURL(photoEditUrl);
      } catch {
        // ignore
      }
    };
  }, [photoEditUrl]);
  const [scheduleSkip, setScheduleSkip] = useState<boolean>(false);
  const [scheduleTimezone, setScheduleTimezone] = useState<string>("");
  const [scheduleCity, setScheduleCity] = useState<string>("");
  const [scheduleSelectedSlots, setScheduleSelectedSlots] = useState<Set<string>>(() => new Set());
  const [scheduleUpcomingCount, setScheduleUpcomingCount] = useState<number>(0);
  const [scheduleUpcomingNextISO, setScheduleUpcomingNextISO] = useState<string>("");
  const [scheduleRows, setScheduleRows] = useState<
    {
      weekday: number;
      label: string;
      enabled: boolean;
      slots: { from: string; to: string }[];
    }[]
  >([
    { weekday: 1, label: "Понеділок", enabled: true, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 2, label: "Вівторок", enabled: true, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 3, label: "Середа", enabled: true, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 4, label: "Четвер", enabled: true, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 5, label: "Пʼятниця", enabled: true, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 6, label: "Субота", enabled: false, slots: [{ from: "09:00", to: "17:00" }] },
    { weekday: 0, label: "Неділя", enabled: false, slots: [{ from: "09:00", to: "17:00" }] },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.split("/").filter(Boolean)[0] || "uk";

  const descLocale = locale === "ru" || locale === "en" || locale === "uk" ? (locale as "uk" | "ru" | "en") : "uk";
  const descText = {
    uk: {
      s1Title: "1. Розкажіть про себе",
      s1Desc:
        "Покажіть учням, хто ви. Розкажіть про досвід викладання та що вам подобається у навчанні. Можете коротко згадати інтереси й хобі.",
      s1Placeholder: "Наприклад: Привіт! Мене звати… Я з…",
      s2Title: "2. Досвід викладання",
      s2Desc: "Опишіть ваш досвід та підхід до навчання.",
      s3Title: "3. Чому учням варто обрати вас",
      s3Desc: "Поясніть, чим ви корисні та як допоможете досягти цілей.",
    },
    ru: {
      s1Title: "1. Расскажите о себе",
      s1Desc:
        "Покажите ученикам, кто вы. Расскажите о своём опыте преподавания и что вам нравится в обучении. Можно коротко упомянуть интересы и хобби.",
      s1Placeholder: "Например: Привет! Меня зовут… Я из…",
      s2Title: "2. Опыт преподавания",
      s2Desc: "Опишите ваш опыт и подход к обучению.",
      s3Title: "3. Почему ученикам стоит выбрать вас",
      s3Desc: "Объясните, чем вы полезны и как поможете достичь целей.",
    },
    en: {
      s1Title: "1. Introduce yourself",
      s1Desc:
        "Show potential students who you are. Share your teaching experience and what you enjoy about teaching. You can briefly mention your interests and hobbies.",
      s1Placeholder: "For example: Hi! My name is… I’m from…",
      s2Title: "2. Teaching experience",
      s2Desc: "Describe your teaching experience and approach.",
      s3Title: "3. Motivate potential students",
      s3Desc: "Tell students why they should choose you and how you can help them reach their goals.",
    },
  }[descLocale];

  useEffect(() => {
    if (!photoEditOpen) return;
    if (!photoEditUrl) return;
    const canvas = photoEditCanvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = 360;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      const rot = (photoEditRotate * Math.PI) / 180;
      const baseScale = size / Math.min(img.width, img.height);
      const scale = baseScale * photoEditZoom;

      ctx.save();
      ctx.translate(cx + photoEditOffset.x, cy + photoEditOffset.y);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-img.width / 2, -img.height / 2);
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      ctx.strokeStyle = "rgba(236,72,153,0.65)";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, size - 4, size - 4);
    };
    img.onerror = () => {
      if (!cancelled) setError("Не вдалося відкрити зображення");
    };
    img.src = photoEditUrl;

    return () => {
      cancelled = true;
    };
  }, [photoEditOpen, photoEditUrl, photoEditZoom, photoEditRotate, photoEditOffset.x, photoEditOffset.y, setError]);

  async function uploadCroppedPhoto(file: File) {
    setPhotoUploading(true);
    setPhotoFileName(file.name);
    setError(null);
    try {
      const canvas = photoEditCanvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");

      const exportSize = 512;
      const out = document.createElement("canvas");
      out.width = exportSize;
      out.height = exportSize;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("Canvas is not ready");

      // draw preview canvas into output canvas to preserve same crop
      octx.drawImage(canvas, 0, 0, exportSize, exportSize);

      const blob: Blob | null = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Не вдалося підготувати фото");

      const fd = new FormData();
      fd.append("file", blob, "profile.jpg");
      const res = await fetch("/api/teacher/upload-photo", { method: "POST", body: fd });
      if (!res.ok) {
        let details = "";
        try {
          const j = (await res.json()) as any;
          details = String(j?.details || j?.error || "");
        } catch {
          try {
            details = await res.text();
          } catch {
            details = "";
          }
        }
        throw new Error(details ? `Не вдалося завантажити фото: ${details}` : "Не вдалося завантажити фото");
      }

      const data = (await res.json()) as any;
      if (data?.url) {
        setPhotoUrl(data.url);
        setStep2SubmitError("");
      }
      setPhotoEditOpen(false);
      setPhotoEditFile(null);
    } catch (err: any) {
      setError(err?.message || "Помилка завантаження фото");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function uploadVideoFile(file: File) {
    if (!file) return;
    if (file.size > VIDEO_MAX_BYTES) {
      const mb = Math.round((file.size / 1024 / 1024) * 10) / 10;
      const maxMb = Math.round((VIDEO_MAX_BYTES / 1024 / 1024) * 10) / 10;
      setError(`Відео завелике (${mb} MB). Максимум ${maxMb} MB.`);
      return;
    }

    // Пытаемся определить длительность для проверки min 30 сек (не блокируем загрузку, только сохраняем длительность)
    try {
      const d = await getVideoDurationSecondsFromBlob(file);
      setVideoDurationSeconds(d);
    } catch {
      setVideoDurationSeconds(null);
    }

    setVideoMinDurationError("");

    setError("");
    setVideoFileUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/teacher/upload-video", { method: "POST", body: fd });
      if (!res.ok) {
        let details = "";
        try {
          const j = (await res.json()) as any;
          details = j?.details || j?.error || "";
        } catch {
          try {
            details = await res.text();
          } catch {
            details = "";
          }
        }
        throw new Error(details ? `Не вдалося завантажити відео: ${details}` : "Не вдалося завантажити відео");
      }
      const data = (await res.json()) as any;
      const url = String(data?.url || "");
      if (!url) throw new Error("Не вдалося завантажити відео");
      setVideoUrl(url);
    } catch (e: any) {
      setError(e?.message || "Не вдалося завантажити відео");
    } finally {
      setVideoFileUploading(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/teacher/onboarding", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        if (cancelled) return;
        const t: Tutor = data.tutor;
        setTutor(t);
        setHeadline(t.headline || "");
        setBio(t.bio || "");
        setRate(t.rateCents ? String(Math.round(t.rateCents / 100)) : "");
        setCurrency(t.currency || "UAH");
        setVideoUrl(t.videoUrl || "");

        const existingMedia = Array.isArray(t.media) ? (t.media as string[]) : [];
        if (existingMedia.length > 0) {
          setPhotoUrl(existingMedia[0] || "");
        }

        const uName = String(t.user?.name || "").trim();
        const uEmail = String(t.user?.email || "").trim();
        setEmail(uEmail);
        if (uName) {
          const parts = uName.split(/\s+/).filter(Boolean);
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" "));
        }
        setCountry(String(t.country || ""));

        const tracks = Array.isArray(t.tracks) ? (t.tracks as string[]) : [];
        const phoneTrack = tracks.find((x) => typeof x === "string" && x.startsWith("phone:"));
        if (phoneTrack) setPhone(phoneTrack.replace("phone:", ""));
        const phoneCcTrack = tracks.find((x) => typeof x === "string" && x.startsWith("phonecc:"));
        if (phoneCcTrack) setPhoneCountry(phoneCcTrack.replace("phonecc:", "") || "UA");
        const adultTrack = tracks.find((x) => typeof x === "string" && x.startsWith("adult:"));
        if (adultTrack) setAdult(adultTrack.includes("true"));

        const tzTrack = tracks.find((x) => typeof x === "string" && x.startsWith("tz:"));
        if (tzTrack) setScheduleTimezone(tzTrack.replace("tz:", ""));
        const cityTrack = tracks.find((x) => typeof x === "string" && x.startsWith("city:"));
        if (cityTrack) setScheduleCity(cityTrack.replace("city:", ""));

        const expYearsTrack = tracks.find((x) => typeof x === "string" && x.startsWith("expyrs:"));
        if (expYearsTrack) setExperienceYears(expYearsTrack.replace("expyrs:", ""));
        const expTrack = tracks.find((x) => typeof x === "string" && x.startsWith("exp:"));
        if (expTrack) setExperienceTag(expTrack.replace("exp:", ""));
        const typeTrack = tracks.find((x) => typeof x === "string" && x.startsWith("type:"));
        if (typeTrack) setTeacherType(typeTrack.replace("type:", ""));

        const levels: Record<string, string> = {};
        for (const tr of tracks) {
          if (typeof tr !== "string") continue;
          if (!tr.startsWith("langlvl:")) continue;
          const rest = tr.replace("langlvl:", "");
          const [code, lvl] = rest.split(":");
          if (code && lvl) levels[code] = lvl;
        }

        const ccode = String(t.country || "").trim();
        const langs = Array.isArray(t.languages) ? (t.languages as string[]) : [];
        const uniqueLangs = Array.from(new Set(langs.filter(Boolean)));
        const hasExistingLangs = uniqueLangs.length > 0;
        const hasCountry = !!ccode;

        if (hasExistingLangs || hasCountry) {
          const derivedNative = COUNTRY_TO_NATIVE_LANG[ccode] || "uk";
          const secondary = uniqueLangs.find((c) => c && c !== derivedNative) || (hasExistingLangs ? uniqueLangs[0] : "en");
          setLangRows([
            { code: derivedNative, level: "native" },
            { code: secondary, level: levels[secondary] || (secondary === "uk" ? "native" : "b2") },
          ]);
        } else {
          setLangRows([{ code: "", level: "b2" }]);
        }

        const parsedSubjectRows: { key: string; level: string }[] = [];
        for (const tr of tracks) {
          if (typeof tr !== "string") continue;
          if (!tr.startsWith("subjlvl:")) continue;
          const rest = tr.replace("subjlvl:", "");
          const [k, lvl] = rest.split(":");
          const key = String(k || "").trim();
          const level = String(lvl || "").trim();
          if (!key || !level) continue;
          parsedSubjectRows.push({ key, level });
        }

        if (parsedSubjectRows.length) {
          setSubjectRows(parsedSubjectRows);
        } else {
          const existingSubjects = Array.isArray(t.subjects) ? (t.subjects as string[]) : [];
          if (existingSubjects.length) {
            setSubjectRows(
              existingSubjects.map((k) => ({
                key: k,
                level: languageSubjectKeys.has(k) ? "b2" : "school",
              })),
            );
          }
        }

        const certNoneTrack = tracks.find((x) => typeof x === "string" && x.startsWith("certnone:"));
        if (certNoneTrack) setNoTeachingCertificate(certNoneTrack.includes("true"));

        const freeFirstTrack = tracks.find((x) => typeof x === "string" && x.startsWith("freefirst:"));
        if (freeFirstTrack) setFreeFirstLesson(freeFirstTrack.includes("true"));

        const certs: CertificationRow[] = [];
        for (const tr of tracks) {
          if (typeof tr !== "string") continue;
          if (!tr.startsWith("cert:")) continue;
          const encoded = tr.replace("cert:", "");
          try {
            const raw = decodeURIComponent(encoded);
            const obj = JSON.parse(raw);
            if (obj && typeof obj === "object") {
              certs.push({
                subject: String((obj as any).subject || ""),
                certificate: String((obj as any).certificate || ""),
                description: String((obj as any).description || ""),
                issuedBy: String((obj as any).issuedBy || ""),
                fromYear: String((obj as any).fromYear || ""),
                toYear: String((obj as any).toYear || ""),
                fileUrl: String((obj as any).fileUrl || ""),
                fileName: String((obj as any).fileName || ""),
              });
            }
          } catch {
            // ignore
          }
        }
        if (certs.length) setCertRows(certs);

        const desc: Record<string, string> = {};
        for (const tr of tracks) {
          if (typeof tr !== "string") continue;
          if (!tr.startsWith("desc:")) continue;
          const rest = tr.replace("desc:", "");
          const [key, ...valueParts] = rest.split(":");
          if (!key) continue;
          const encodedValue = valueParts.join(":");
          try {
            desc[key] = decodeURIComponent(encodedValue || "");
          } catch {
            desc[key] = encodedValue || "";
          }
        }
        if (typeof desc.intro === "string") setProfileIntro(desc.intro);
        if (typeof desc.experience === "string") setProfileExperience(desc.experience);
        if (typeof desc.motivate === "string") setProfileMotivation(desc.motivate);

        // Load existing availability windows to preselect slots for step 6 schedule picker.
        try {
          const availRes = await fetch("/api/tutor/availability/me", { cache: "no-store" });
          const availData = await availRes.json().catch(() => null);
          if (!cancelled && availRes.ok) {
            const windows = Array.isArray(availData?.availability) ? (availData.availability as any[]) : [];
            const normalized = windows
              .map((w) => ({
                weekday: Number((w as any)?.weekday),
                startMin: Number((w as any)?.startMin),
                endMin: Number((w as any)?.endMin),
                timezone: String((w as any)?.timezone || scheduleTimezone || "Europe/Kyiv"),
              }))
              .filter((w) => Number.isFinite(w.weekday) && w.weekday >= 0 && w.weekday <= 6 && Number.isFinite(w.startMin) && Number.isFinite(w.endMin) && w.endMin > w.startMin);
            setScheduleSelectedSlots(windowsToSlotSet(normalized as any, 30, 60));
          }
        } catch {
          // ignore
        }

        // Load upcoming bookings count for informational warning on schedule change.
        try {
          const upRes = await fetch("/api/tutor/bookings/upcoming", { cache: "no-store" });
          const upData = await upRes.json().catch(() => null);
          if (!cancelled && upRes.ok) {
            setScheduleUpcomingCount(Math.max(0, Number(upData?.count || 0) || 0));
            setScheduleUpcomingNextISO(String(upData?.nextStartsAt || ""));
          }
        } catch {
          // ignore
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Помилка завантаження");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function formatGmtOffsetMinutes(offsetMinutes: number) {
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `GMT${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function getTimeInTimeZone(timeZone: string, locale: string) {
    try {
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date());
    } catch {
      return "";
    }
  }

  function getGmtOffsetLabelForTimeZone(timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date());
      const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
      // Examples: "GMT+2", "GMT+02:00", "UTC+2"
      const cleaned = tzName.replace("UTC", "GMT").replace("GMT", "GMT");
      const m = cleaned.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
      if (!m) return tzName;
      const sign = m[1];
      const hh = String(m[2]).padStart(2, "0");
      const mm = String(m[3] || "00");
      return `GMT${sign}${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function getTimeZoneOptions(): string[] {
    const popular = [
      "Europe/Kyiv",
      "Europe/Warsaw",
      "Europe/Berlin",
      "Europe/Paris",
      "Europe/London",
      "Europe/Istanbul",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "America/Toronto",
      "Asia/Dubai",
      "Asia/Tokyo",
    ];

    let all: string[] = [];
    try {
      const anyIntl: any = Intl as any;
      all = Array.isArray(anyIntl?.supportedValuesOf) ? anyIntl.supportedValuesOf("timeZone") : [];
    } catch {
      all = [];
    }

    if (!all.length) all = popular;

    const uniq = new Set<string>();
    const out: string[] = [];
    for (const z of popular) {
      if (!uniq.has(z)) {
        uniq.add(z);
        out.push(z);
      }
    }
    const rest = all.filter((z) => !uniq.has(z)).sort((a, b) => a.localeCompare(b));
    return [...out, ...rest];
  }

  function tzToCity(tz: string) {
    const last = String(tz || "").split("/").pop() || "";
    return last.replace(/_/g, " ");
  }

  function timeToMinutes(t: string) {
    const [h, m] = String(t || "")
      .split(":")
      .map((x) => Number(x) || 0);
    return h * 60 + m;
  }

  function normalizeSlots(slots: { from: string; to: string }[]) {
    const uniq = new Set<string>();
    const out: { from: string; to: string }[] = [];
    for (const s of Array.isArray(slots) ? slots : []) {
      const from = String(s?.from || "");
      const to = String(s?.to || "");
      if (!from || !to) continue;
      const key = `${from}-${to}`;
      if (uniq.has(key)) continue;
      uniq.add(key);
      out.push({ from, to });
    }
    return out;
  }

  function hasOverlapsOrDuplicates(slots: { from: string; to: string }[]) {
    const normalized = normalizeSlots(slots);
    if (normalized.length !== (Array.isArray(slots) ? slots.filter((s) => s?.from && s?.to).length : 0)) return true;

    const ranges = normalized
      .map((s) => ({ start: timeToMinutes(s.from), end: timeToMinutes(s.to) }))
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end))
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < ranges.length; i += 1) {
      if (ranges[i].end <= ranges[i].start) return true;
      if (i > 0 && ranges[i].start < ranges[i - 1].end) return true;
    }

    return false;
  }

  function wouldOverlapIfUpdate(
    daySlots: { from: string; to: string }[],
    index: number,
    nextSlot: { from: string; to: string },
  ) {
    const normalized = normalizeSlots(daySlots.map((s, i) => (i === index ? nextSlot : s)));
    const ranges = normalized
      .map((s) => ({ start: timeToMinutes(s.from), end: timeToMinutes(s.to) }))
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end))
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < ranges.length; i += 1) {
      if (ranges[i].end <= ranges[i].start) return true;
      if (i > 0 && ranges[i].start < ranges[i - 1].end) return true;
    }
    return false;
  }

  useEffect(() => {
    if (scheduleTimezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
    setScheduleTimezone(tz);
    setScheduleCity((prev) => prev || tzToCity(tz));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleTimezone]);

  function countWords(text: string) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean).length;
  }

  function formatPhoneDisplay(digits: string, cc: string) {
    const d = String(digits || "").replace(/\D/g, "");
    if (!d) return "";
    if (cc === "UA" || cc === "PL") {
      const a = d.slice(0, 2);
      const b = d.slice(2, 5);
      const c = d.slice(5, 7);
      const e = d.slice(7, 9);
      let out = "";
      if (a) out += `(${a}`;
      if (a.length === 2) out += ")";
      if (b) out += (out ? " " : "") + b;
      if (c) out += " " + c;
      if (e) out += " " + e;
      return out;
    }

    if (cc === "US" || cc === "CA") {
      const a = d.slice(0, 3);
      const b = d.slice(3, 6);
      const c = d.slice(6, 10);
      let out = "";
      if (a) out += `(${a}`;
      if (a.length === 3) out += ")";
      if (b) out += (out ? " " : "") + b;
      if (c) out += "-" + c;
      return out;
    }

    // fallback: group 3-3-4
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 10);
    return [a, b, c].filter(Boolean).join(" ");
  }

  function hasContactInfo(text: string) {
    const t = String(text || "");
    if (/\b\S+@\S+\b/.test(t)) return true;
    if (/https?:\/\//i.test(t)) return true;
    if (/\b(tg|telegram|whatsapp|viber|insta|instagram)\b/i.test(t)) return true;
    if (/(\+?\d[\d\s\-()]{7,}\d)/.test(t)) return true;
    return false;
  }

  function looksNonEnglish(text: string) {
    const t = String(text || "");
    return false;
  }

  function validateDescSection(text: string, minWords: number) {
    const warnings: string[] = [];
    const words = countWords(text);
    const chars = String(text || "").trim().length;
    if (words < minWords && chars < 50) warnings.push("Мінімум 50 слів або 50 символів.");
    if (hasContactInfo(text)) warnings.push("Не додавайте контактні дані (телефон, email, посилання, соцмережі).");
    return { ok: warnings.length === 0, warnings, words, chars };
  }

  function validateHeadline(text: string) {
    const warnings: string[] = [];
    const t = String(text || "");
    const len = t.trim().length;
    if (len === 0) warnings.push("Заповніть заголовок.");
    if (len > 250) warnings.push(`Переконайтеся, що це значення містить не більше ніж 250 символів (зараз ${len}).`);
    if (hasContactInfo(t)) warnings.push("Не додавайте контактні дані (телефон, email, посилання, соцмережі).");
    if (looksNonEnglish(t)) warnings.push("Мова цього заголовку повинна бути англійська.");
    return { ok: warnings.length === 0, warnings, len };
  }

  async function openVideoRecorder() {
    // Если модалка уже открыта и пользователь нажимает «Пересняти»,
    // нужно корректно остановить текущие ресурсы перед повторным getUserMedia.
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    stopVideoStream();
    setVideoRecordError("");
    setVideoRecordOpen(true);
    setVideoStreamLoading(true);
    setVideoHasStream(false);
    recordedVideoBlobRef.current = null;
    setHasRecordedVideo(false);
    setVideoRecordSeconds(0);
    setVideoDurationSeconds(null);
    setVideoMinDurationError("");
    if (recordedVideoUrl) {
      try {
        URL.revokeObjectURL(recordedVideoUrl);
      } catch {
        // ignore
      }
      setRecordedVideoUrl("");
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Запис відео не підтримується у цьому браузері");
      }
      const preferredConstraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const fallbackConstraints: MediaStreamConstraints = {
        video: { facingMode: "user" },
        audio: true,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (e: any) {
        const msg = String(e?.message || "");
        const name = String(e?.name || "");
        const isConstraintError =
          name === "OverconstrainedError" ||
          name === "ConstraintNotSatisfiedError" ||
          msg.toLowerCase().includes("invalid constraint") ||
          msg.toLowerCase().includes("overconstrained");

        if (!isConstraintError) throw e;
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      mediaStreamRef.current = stream;
      setVideoHasStream(true);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => null);
      }
    } catch (e: any) {
      setVideoRecordError(e?.message || "Не вдалося отримати доступ до камери/мікрофона. Перевірте дозволи браузера.");
      setVideoHasStream(false);
    } finally {
      setVideoStreamLoading(false);
    }
  }

  function stopVideoStream() {
    const stream = mediaStreamRef.current;
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    setVideoHasStream(false);
    if (liveVideoRef.current) {
      try {
        liveVideoRef.current.pause();
      } catch {
        // ignore
      }
      (liveVideoRef.current as any).srcObject = null;
    }
  }

  function closeVideoRecorder() {
    setVideoRecording(false);
    setVideoStreamLoading(false);
    if (videoRecordIntervalRef.current) {
      try {
        window.clearInterval(videoRecordIntervalRef.current);
      } catch {
        // ignore
      }
      videoRecordIntervalRef.current = null;
    }
    setVideoRecordSeconds(0);
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    stopVideoStream();
    setVideoRecordOpen(false);
    setVideoUploading(false);
    setVideoRecordError("");
    setHasRecordedVideo(false);
  }

  function startVideoRecording() {
    setVideoRecordError("");
    const stream = mediaStreamRef.current;
    if (!stream) {
      setVideoRecordError("Немає доступу до камери/мікрофона. Дозвольте доступ і спробуйте ще раз.");
      return;
    }

    const mimeCandidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = mimeCandidates.find((m) => {
      try {
        return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });

    const chunks: Blob[] = [];
    try {
      const rec = new MediaRecorder(
        stream,
        (mimeType
          ? {
              mimeType,
              // Делаем файл меньше, чтобы 2 хвилини проходили по размеру
              videoBitsPerSecond: 900_000,
              audioBitsPerSecond: 64_000,
            }
          : {
              videoBitsPerSecond: 900_000,
              audioBitsPerSecond: 64_000,
            }) as any,
      );
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || "video/webm" });
        recordedVideoBlobRef.current = blob;
        if (!blob || blob.size === 0) {
          setVideoRecordError("Відео не записалося. Спробуйте ще раз.");
          recordedVideoBlobRef.current = null;
          setHasRecordedVideo(false);
          setVideoDurationSeconds(null);
          if (recordedVideoUrl) {
            try {
              URL.revokeObjectURL(recordedVideoUrl);
            } catch {
              // ignore
            }
          }
          setRecordedVideoUrl("");
          stopVideoStream();
          return;
        }
        try {
          const url = URL.createObjectURL(blob);
          setRecordedVideoUrl(url);
          setHasRecordedVideo(true);
        } catch {
          setRecordedVideoUrl("");
          setHasRecordedVideo(false);
        }

        // Пытаемся определить длительность для проверки min 30 сек
        (async () => {
          const d = await getVideoDurationSecondsFromBlob(blob);
          setVideoDurationSeconds(d);
        })();

        stopVideoStream();
      };
      // Пишем чанками, чтобы dataavailable стабильно приходил (особенно Safari)
      rec.start(1000);
      setVideoRecording(true);
      setVideoRecordSeconds(0);
      if (videoRecordIntervalRef.current) {
        try {
          window.clearInterval(videoRecordIntervalRef.current);
        } catch {
          // ignore
        }
        videoRecordIntervalRef.current = null;
      }
      videoRecordIntervalRef.current = window.setInterval(() => {
        setVideoRecordSeconds((s) => {
          const next = s + 1;
          if (next >= VIDEO_MAX_SECONDS) {
            try {
              stopVideoRecording();
            } catch {
              // ignore
            }
            return VIDEO_MAX_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setVideoRecordError(e?.message || "Не вдалося почати запис");
    }
  }

  function stopVideoRecording() {
    try {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.requestData();
        } catch {
          // ignore
        }
        rec.stop();
      }
    } catch {
      // ignore
    }
    setVideoRecording(false);
    if (videoRecordIntervalRef.current) {
      try {
        window.clearInterval(videoRecordIntervalRef.current);
      } catch {
        // ignore
      }
      videoRecordIntervalRef.current = null;
    }
  }

  async function uploadRecordedVideo() {
    const blob = recordedVideoBlobRef.current;
    if (!blob) {
      setVideoRecordError("Спочатку запишіть відео");
      return;
    }

    if (blob.size > VIDEO_MAX_BYTES) {
      const mb = Math.round((blob.size / 1024 / 1024) * 10) / 10;
      const maxMb = Math.round((VIDEO_MAX_BYTES / 1024 / 1024) * 10) / 10;
      setVideoRecordError(`Відео завелике (${mb} MB). Максимум ${maxMb} MB. Запишіть коротше.`);
      return;
    }
    setVideoRecordError("");
    setVideoUploading(true);
    try {
      const fd = new FormData();
      const mime = blob.type || "video/webm";
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `intro.${ext}`, { type: mime });
      fd.append("file", file);
      const res = await fetch("/api/teacher/upload-video", { method: "POST", body: fd });
      if (!res.ok) {
        let details = "";
        try {
          const j = (await res.json()) as any;
          details = String(j?.details || j?.error || "");
        } catch {
          try {
            details = await res.text();
          } catch {
            details = "";
          }
        }
        throw new Error(details ? `Не вдалося завантажити відео: ${details}` : "Не вдалося завантажити відео");
      }
      const data = (await res.json()) as any;
      const url = String(data?.url || "");
      if (!url) throw new Error("Не вдалося отримати посилання на відео");
      setVideoUrl(url);
      closeVideoRecorder();
    } catch (e: any) {
      setVideoRecordError(e?.message || "Помилка завантаження відео");
    } finally {
      setVideoUploading(false);
    }
  }

  useEffect(() => {
    return () => {
      stopVideoStream();
      if (recordedVideoUrl) {
        try {
          URL.revokeObjectURL(recordedVideoUrl);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!freeFirstLesson) return;
    if (!rate30) return;
    setRate30("");
  }, [freeFirstLesson, rate30]);

  async function saveAndNext(partial: any, nextStep?: number) {
    setError(null);
    try {
      const res = await fetch("/api/teacher/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" && data.error.trim().length > 0 ? data.error : "Не вдалось зберегти";
        throw new Error(msg);
      }
      setTutor(data.tutor);
      if (typeof nextStep === "number") setStep(nextStep);
    } catch (e: any) {
      setError(e?.message || "Помилка збереження");
    }
  }

  function validateStep(currentStep: number): { ok: boolean; errs: Record<string, string> } {
    const errs: Record<string, string> = {};

    const phoneDigits = String(phone || "").replace(/\D/g, "");
    const phoneRules: Record<string, { min: number; max: number }> = {
      UA: { min: 9, max: 9 },
      PL: { min: 9, max: 9 },
      DE: { min: 10, max: 11 },
      FR: { min: 9, max: 9 },
      IT: { min: 9, max: 10 },
      ES: { min: 9, max: 9 },
      US: { min: 10, max: 10 },
      GB: { min: 10, max: 10 },
      CA: { min: 10, max: 10 },
    };
    const phoneRule = phoneRules[phoneCountry] || { min: 6, max: 15 };

    if (currentStep === 1) {
      if (!firstName.trim()) errs.firstName = "Заповніть імʼя.";
      if (!lastName.trim()) errs.lastName = "Заповніть прізвище.";
      if (!country.trim()) errs.country = "Оберіть країну.";
      if (!subjectRows.some((r) => String(r.key || "").trim())) errs.subjects = "Оберіть хоча б один предмет.";
      const uniqueSubjectsCount = new Set(subjectRows.map((r) => String(r.key || "").trim()).filter(Boolean)).size;
      if (uniqueSubjectsCount > 5) errs.subjects = "Максимум 5 предметів.";
      if (!adult) errs.adult = "Підтвердіть, що вам більше 18.";

      const firstLang = langRows[0];
      if (!firstLang || !String(firstLang.code || "").trim()) errs.languages = "Оберіть мову спілкування.";

      // phone is optional, but if provided it must look like a real number
      if (phoneDigits.length > 0 && (phoneDigits.length < phoneRule.min || phoneDigits.length > phoneRule.max)) {
        errs.phone = `Вкажіть коректний номер телефону (${phoneRule.min}–${phoneRule.max} цифр).`;
      }
    }

    setStepErrors(errs);
    return { ok: Object.keys(errs).length === 0, errs };
  }

  const totalSteps = 7;

  const moderationStatus = (() => {
    const tracks = Array.isArray(tutor?.tracks) ? (tutor?.tracks as string[]) : [];
    return tracks.find((t) => typeof t === "string" && t.startsWith("status:"))?.replace("status:", "") || "draft";
  })();

  function validateBeforeSubmit(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Заповніть ім'я та прізвище.";
    const selectedSubjects = subjectRows.map((r) => String(r.key || "").trim()).filter(Boolean);
    if (!selectedSubjects.length) return "Оберіть хоча б один предмет.";
    if (!scheduleTimezone.trim()) return "Оберіть часовий пояс у розкладі.";
    const introOk = validateDescSection(profileIntro, 50).ok;
    const expOk = validateDescSection(profileExperience, 50).ok;
    const motOk = validateDescSection(profileMotivation, 50).ok;
    if (!introOk || !expOk || !motOk) return "Заповніть опис профілю (усі секції — мінімум 50 слів).";
    const cleaned = String(rate || "").replace(/,/g, ".").trim();
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return "Вкажіть коректну ціну за урок.";
    return null;
  }

  const commonHeader = (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold mb-1">Анкета викладача</h1>
      <p className="text-sm text-neutral-600">Крок {step} з {totalSteps}</p>
    </header>
  );

  const subjectOptions = [
    { key: "english", label: "Англійська" },
    { key: "french", label: "Французька" },
    { key: "german", label: "Німецька" },
    { key: "italian", label: "Італійська" },
    { key: "spanish", label: "Іспанська" },
    { key: "polish", label: "Польська" },
    { key: "czech", label: "Чеська" },
    { key: "korean", label: "Корейська мова" },
    { key: "ukrainian", label: "Українська мова" },
    { key: "math", label: "Математика" },
    { key: "geometry", label: "Геометрія" },
    { key: "physics", label: "Фізика" },
    { key: "chemistry", label: "Хімія" },
    { key: "biology", label: "Біологія" },
    { key: "history", label: "Історія" },
    { key: "geography", label: "Географія" },
    { key: "literature", label: "Література" },
    { key: "computer_science", label: "Інформатика" },
    { key: "programming", label: "Програмування" },
    { key: "management", label: "Менеджмент" },
    { key: "economics", label: "Економіка" },
    { key: "psychology", label: "Психологія" },
    { key: "pedagogy_psychology", label: "Педагогіка та психологія" },
    { key: "accounting_finance", label: "Облік та фінанси" },
    { key: "political_science", label: "Політологія" },
    { key: "tznk", label: "ТЗНК" },
    { key: "law", label: "Право" },
    { key: "linguistics", label: "Мовознавство" },
    { key: "research_methodology", label: "Методологія досліджень" },
    { key: "primary_school", label: "Початкові класи 1–4" },
    { key: "junior_classes", label: "Молодші класи" },
  ];

  const languageOptions = [
    { code: "uk", label: "Українська" },
    { code: "ru", label: "Російська" },
    { code: "en", label: "Англійська" },
    { code: "pl", label: "Польська" },
    { code: "de", label: "Німецька" },
    { code: "fr", label: "Французька" },
    { code: "es", label: "Іспанська" },
    { code: "it", label: "Італійська" },
    { code: "cs", label: "Чеська" },
    { code: "ko", label: "Корейська" },
  ];

  const languageLevelOptions = [
    { key: "native", label: "Рідна мова" },
    { key: "c2", label: "C2" },
    { key: "c1", label: "C1" },
    { key: "b2", label: "B2" },
    { key: "b1", label: "B1" },
  ];

  const languageSubjectLevelOptions = [
    ...languageLevelOptions,
    { key: "conversation", label: "Розмовна мова" },
    { key: "kids", label: "Репетитор для дітей" },
    { key: "primary_1_4", label: "Початкові класи 1–4" },
    { key: "grade_5_9", label: "5–9 клас" },
    { key: "grade_10_11", label: "10–11 клас" },
    { key: "preschool", label: "Підготовка до школи" },
    { key: "dpa", label: "Підготовка до ДПА" },
    { key: "nmt", label: "Підготовка НМТ/ЗНО" },
    { key: "olympiads", label: "Підготовка до олімпіад" },
  ];

  const nonLanguageSubjectLevelOptions = [
    { key: "school", label: "Шкільна програма" },
    { key: "kids", label: "Репетитор для дітей" },
    { key: "primary_1_4", label: "Початкові класи 1–4" },
    { key: "grade_5_9", label: "5–9 клас" },
    { key: "grade_10_11", label: "10–11 клас" },
    { key: "preschool", label: "Підготовка до школи" },
    { key: "dpa", label: "Підготовка до ДПА" },
    { key: "nmt", label: "Підготовка НМТ/ЗНО" },
    { key: "olympiads", label: "Підготовка до олімпіад" },
  ];

  const subjectDirectionOptions = useMemo(() => {
    const langKeys = new Set([
      "native",
      "c2",
      "c1",
      "b2",
      "b1",
      "conversation",
      "kids",
      "primary_1_4",
      "grade_5_9",
      "grade_10_11",
      "preschool",
      "dpa",
      "nmt",
      "olympiads",
    ]);
    const nonLangKeys = new Set([
      "school",
      "kids",
      "primary_1_4",
      "grade_5_9",
      "grade_10_11",
      "preschool",
      "dpa",
      "nmt",
      "olympiads",
    ]);

    const lang = languageSubjectLevelOptions.filter((o) => langKeys.has(o.key));
    const nonLang = nonLanguageSubjectLevelOptions.filter((o) => nonLangKeys.has(o.key));

    return { lang, nonLang };
  }, [languageSubjectLevelOptions, nonLanguageSubjectLevelOptions]);

  const langPrimaryLevelKeys = useMemo(() => new Set(["native", "c2", "c1", "b2", "b1"]), []);
  const nonLangPrimaryLevelKeys = useMemo(
    () => new Set(["school", "primary_1_4", "grade_5_9", "grade_10_11", "preschool"]),
    [],
  );

  useEffect(() => {
    const selectedSubjects = Array.from(new Set(subjectRows.map((r) => String(r.key || "").trim()).filter(Boolean)));
    setDirectionsBySubject((prev) => {
      const next: Record<string, string[]> = {};
      for (const s of selectedSubjects) {
        next[s] = Array.isArray(prev?.[s]) ? prev[s].slice() : [];
      }
      return next;
    });
  }, [subjectRows]);

  useEffect(() => {
    setSubjectRows((prev) => {
      const rows = Array.isArray(prev) ? prev : [];
      const seen = new Set<string>();
      let hasEmpty = false;
      const next: { key: string; level: string }[] = [];

      for (const r of rows) {
        const k = String(r?.key || "").trim();
        const lvl = String(r?.level || "").trim() || "b2";
        if (!k) {
          if (hasEmpty) continue;
          hasEmpty = true;
          next.push({ key: "", level: lvl });
          continue;
        }
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ key: k, level: lvl });
      }

      if (!next.length) return [{ key: "", level: "b2" }];
      if (next.length === rows.length) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-sm text-neutral-600">Завантаження анкети викладача…</div>
      </main>
    );
  }

  if (!tutor) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-2">Анкета викладача</h1>
        <p className="text-sm text-red-600">Не вдалося створити анкету. Спробуйте перезайти.</p>
      </main>
    );
  }

  const phoneCountryOptions = [
    { code: "UA", label: "Україна", flag: "🇺🇦", dial: "+380" },
    { code: "PL", label: "Польща", flag: "🇵🇱", dial: "+48" },
    { code: "DE", label: "Німеччина", flag: "🇩🇪", dial: "+49" },
    { code: "FR", label: "Франція", flag: "🇫🇷", dial: "+33" },
    { code: "IT", label: "Італія", flag: "🇮🇹", dial: "+39" },
    { code: "ES", label: "Іспанія", flag: "🇪🇸", dial: "+34" },
    { code: "US", label: "США", flag: "🇺🇸", dial: "+1" },
    { code: "GB", label: "Велика Британія", flag: "🇬🇧", dial: "+44" },
    { code: "CA", label: "Канада", flag: "🇨🇦", dial: "+1" },
  ];

  const countries = phoneCountryOptions;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {commonHeader}

      {moderationStatus === "pending" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">Анкета на модерації</div>
          <div className="mt-1 text-amber-900/90">Ви можете вносити правки — ми розглянемо актуальну версію.</div>
        </div>
      )}

      {(moderationStatus === "rejected" || moderationStatus === "needs_revision") && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="font-semibold">Анкета відхилена</div>
          {tutor.moderationNote ? <div className="mt-1 text-red-900/90">Причина: {tutor.moderationNote}</div> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await saveAndNext({ resetOnboarding: true }, 1);
                  setSubmitted(false);
                  setFirstName("");
                  setLastName("");
                  setSubjects([]);
                  setSubjectRows([{ key: "", level: "b2" }]);
                  setProfileIntro("");
                  setProfileExperience("");
                  setProfileMotivation("");
                  setScheduleTimezone("");
                  setScheduleCity("");
                  setScheduleSkip(false);
                  setRate("");
                  setCurrency("UAH");
                  setVideoUrl("");
                  setPhotoUrl("");
                } catch (e: any) {
                  setError(e?.message || "Не вдалося скинути анкету");
                }
              }}
              className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Почати заново
            </button>
          </div>
        </div>
      )}

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {step === 1 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Дані</h2>
          <p className="text-sm text-neutral-600">
            Почніть створювати свій профіль репетитора. Дані збережуться автоматично після натискання “Зберегти і продовжити”.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Імʼя</label>
              <input
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setStep1SubmitError("");
                  setStepErrors((p) => {
                    if (!p.firstName) return p;
                    const { firstName: _drop, ...rest } = p;
                    return rest;
                  });
                }}
                ref={firstNameRef}
                className={`w-full h-11 rounded-xl border bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${
                  stepErrors.firstName ? "border-red-400" : "border-neutral-200"
                }`}
              />
              {stepErrors.firstName ? <div className="mt-1 text-xs text-red-600">{stepErrors.firstName}</div> : null}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Прізвище</label>
              <input
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setStep1SubmitError("");
                  setStepErrors((p) => {
                    if (!p.lastName) return p;
                    const { lastName: _drop, ...rest } = p;
                    return rest;
                  });
                }}
                ref={lastNameRef}
                className={`w-full h-11 rounded-xl border bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${
                  stepErrors.lastName ? "border-red-400" : "border-neutral-200"
                }`}
              />
              {stepErrors.lastName ? <div className="mt-1 text-xs text-red-600">{stepErrors.lastName}</div> : null}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ел. пошта</label>
            <input
              value={email}
              readOnly
              className="w-full h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Країна народження</label>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => {
                  const next = e.target.value;
                  setCountry(next);
                  setStep1SubmitError("");
                  setStepErrors((p) => {
                    if (!p.country) return p;
                    const { country: _drop, ...rest } = p;
                    return rest;
                  });
                  const nativeLang = COUNTRY_TO_NATIVE_LANG[next];
                  if (nativeLang) {
                    setLangRows((prev) => {
                      const rest = Array.isArray(prev) ? prev.slice(1) : [];
                      return [{ code: nativeLang, level: "native" }, ...rest];
                    });
                  }
                }}
                ref={countryRef}
                className={`w-full h-11 rounded-xl border bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none ${
                  stepErrors.country ? "border-red-400" : "border-neutral-200"
                }`}
              >
                <option value="">Оберіть країну…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
            </div>
            {stepErrors.country ? <div className="mt-1 text-xs text-red-600">{stepErrors.country}</div> : null}
          </div>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-sm font-medium">Мова спілкування</div>
              <div className="text-sm font-medium md:text-right">Рівень</div>
            </div>
            {stepErrors.languages ? <div className="mt-1 text-xs text-red-600">{stepErrors.languages}</div> : null}
            <div className="mt-2 space-y-2">
              {langRows.map((row, idx) => {
                const isNativeLocked = idx === 0 && !!country;
                return (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                    <div className="relative">
                      <select
                        value={row.code}
                        onChange={(e) => {
                          if (isNativeLocked) return;
                          const v = e.target.value;
                          setLangTouched(true);
                          setLangRows((prev) => prev.map((r, i) => (i === idx ? { ...r, code: v } : r)));
                          setStepErrors((p) => {
                            if (!p.languages) return p;
                            const { languages: _drop, ...rest } = p;
                            return rest;
                          });
                        }}
                        disabled={isNativeLocked}
                        className={`w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none ${
                          isNativeLocked ? "opacity-80" : ""
                        }`}
                      >
                        {languageOptions.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      {!isNativeLocked ? (
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 md:justify-self-end">
                      <div className="relative flex-1 md:flex-none md:w-60">
                        <select
                          value={row.level}
                          onChange={(e) => {
                            if (isNativeLocked) return;
                            const v = e.target.value;
                            setLangTouched(true);
                            setLangRows((prev) => prev.map((r, i) => (i === idx ? { ...r, level: v } : r)));
                          }}
                          disabled={isNativeLocked}
                          className={`w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none ${
                            isNativeLocked ? "opacity-80" : ""
                          }`}
                        >
                          {languageLevelOptions.map((l) => (
                            <option key={l.key} value={l.key}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        {!isNativeLocked ? (
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
                        ) : null}
                      </div>

                      {langRows.length > 1 && idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => setLangRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-11 w-11 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
                          title="Видалити"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          <button
            type="button"
            onClick={() => {
              if (langRows.length >= 3) return;
              setLangTouched(true);
              setLangRows((prev) => {
                const used = new Set((Array.isArray(prev) ? prev : []).map((r) => r.code).filter(Boolean));
                const candidate = languageOptions.find((l) => !used.has(l.code))?.code || "en";
                return [...prev, { code: candidate, level: "b2" }];
              });
            }}
            disabled={langRows.length >= 3}
            className="mt-3 text-sm underline text-neutral-700 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Додати мову (до 3)
          </button>
        </div>

        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm font-medium">Предмети, які ви викладаєте</div>
            <div className="text-sm font-medium md:text-right"></div>
          </div>
          {stepErrors.subjects ? <div className="mt-1 text-xs text-red-600">{stepErrors.subjects}</div> : null}
          <div className="mt-2 space-y-2">
            {(() => {
              const groups: Array<{ key: string; indexes: number[] }> = [];
              const pos = new Map<string, number>();

              for (let i = 0; i < subjectRows.length; i += 1) {
                const k = String(subjectRows[i]?.key || "").trim();
                if (!k) {
                  groups.push({ key: "", indexes: [i] });
                  continue;
                }
                const existing = pos.get(k);
                if (typeof existing === "number") groups[existing].indexes.push(i);
                else {
                  pos.set(k, groups.length);
                  groups.push({ key: k, indexes: [i] });
                }
              }

              const usedSubjectKeys = new Set(
                groups
                  .map((g) => String(g.key || "").trim())
                  .filter(Boolean),
              );
              const maxSubjectsReached = usedSubjectKeys.size >= 5;

              return groups.map((g, gidx) => {
                const key = String(g.key || "").trim();
                const isLang = key ? languageSubjectKeys.has(key) : false;
                const defaultLevel = isLang ? "b2" : "school";
                const firstRowIdx = g.indexes[0];
                const firstRow = typeof firstRowIdx === "number" ? subjectRows[firstRowIdx] : null;

                  const deleteSubjectGroup = () => {
                    setSubjectRows((prev) => {
                      const idxSet = new Set(g.indexes);
                      const next = (Array.isArray(prev) ? prev : []).filter((_, i) => !idxSet.has(i));
                      return next.length ? next : [{ key: "", level: "b2" }];
                    });
                  };

                  return (
                    <div key={`${key || "empty"}-${gidx}`} className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="relative">
                          <select
                            value={key}
                            onChange={(e) => {
                              const v = e.target.value;
                              const nextKey = String(v || "").trim();
                              const nextIsLang = nextKey ? languageSubjectKeys.has(nextKey) : false;
                              const nextDefaultLevel = nextIsLang ? "b2" : "school";
                              setSubjectRows((prev) =>
                                prev.map((r, i) => {
                                  if (!g.indexes.includes(i)) return r;
                                  const nextLevel = r.level || nextDefaultLevel;
                                  return { ...r, key: nextKey, level: nextLevel };
                                }),
                              );

                              if (nextKey) {
                                setDirectionsBySubject((prev) => {
                                  const next: Record<string, string[]> = { ...(prev || {}) };
                                  const cur = Array.isArray(next[nextKey]) ? next[nextKey] : [];
                                  const isNextLang = languageSubjectKeys.has(nextKey);
                                  const primaryKeys = isNextLang ? langPrimaryLevelKeys : nonLangPrimaryLevelKeys;
                                  const hasPrimary = cur.some((x) => primaryKeys.has(x));
                                  const ensured = hasPrimary ? cur : Array.from(new Set([...cur, nextDefaultLevel]));
                                  next[nextKey] = ensured;
                                  return next;
                                });
                              }

                              setStepErrors((p) => {
                                if (!p.subjects) return p;
                                const { subjects: _drop, ...rest } = p;
                                return rest;
                              });
                            }}
                            ref={gidx === 0 ? firstSubjectRef : undefined}
                            className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none"
                          >
                            <option value="">Оберіть предмет…</option>
                            {subjectOptions.map((s) => {
                              const disabledAlreadyUsed = !!s.key && s.key !== key && usedSubjectKeys.has(s.key);
                              const disabledByLimit = !key && maxSubjectsReached;
                              const disabled = disabledAlreadyUsed || disabledByLimit;
                              return (
                                <option key={s.key} value={s.key} disabled={disabled}>
                                  {s.label}
                                </option>
                              );
                            })}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
                        </div>

                        <button
                          type="button"
                          onClick={deleteSubjectGroup}
                          className="h-11 w-11 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50 justify-self-end"
                          title="Видалити предмет"
                          disabled={!key}
                        >
                          ×
                        </button>
                      </div>

                      {key ? (
                        <div className="pt-1">
                          <div className="text-xs font-semibold text-neutral-700">Напрямки</div>
                          <div className="mt-2 space-y-3">
                            {(() => {
                              const selected = Array.isArray(directionsBySubject?.[key]) ? directionsBySubject[key] : [];
                              const isLangSubject = languageSubjectKeys.has(key);
                              const primaryKeys = isLangSubject ? langPrimaryLevelKeys : nonLangPrimaryLevelKeys;
                              const all = isLangSubject ? subjectDirectionOptions.lang : subjectDirectionOptions.nonLang;

                              const primary = all.filter((o) => primaryKeys.has(o.key));
                              const other = all.filter((o) => !primaryKeys.has(o.key));

                              const renderChip = (o: { key: string; label: string }) => {
                                const active = selected.includes(o.key);
                                return (
                                  <button
                                    key={o.key}
                                    type="button"
                                    onClick={() => {
                                      const isExclusivePrimary = isLangSubject && langPrimaryLevelKeys.has(o.key);
                                      setDirectionsBySubject((prev) => {
                                        const next: Record<string, string[]> = { ...(prev || {}) };
                                        const cur = Array.isArray(next[key]) ? next[key] : [];

                                        let nextArr = active ? cur.filter((x) => x !== o.key) : Array.from(new Set([...cur, o.key]));

                                        if (isExclusivePrimary && !active) {
                                          nextArr = nextArr.filter((x) => !langPrimaryLevelKeys.has(x) || x === o.key);
                                        }

                                        if (!nextArr.some((x) => primaryKeys.has(x))) {
                                          nextArr = Array.from(new Set([...nextArr, defaultLevel]));
                                        }

                                        next[key] = nextArr;
                                        return next;
                                      });

                                      if (isExclusivePrimary) {
                                        setSubjectRows((prev) =>
                                          prev.map((r, i) => {
                                            if (!g.indexes.includes(i)) return r;
                                            if (i !== firstRowIdx) return r;
                                            const curLvl = String(r.level || "").trim() || defaultLevel;
                                            const nextLvl = active ? curLvl : o.key;
                                            return { ...r, level: nextLvl };
                                          }),
                                        );
                                      }
                                    }}
                                    className={
                                      active
                                        ? "inline-flex items-center gap-2 h-9 rounded-full bg-black px-3 text-sm font-semibold text-white"
                                        : "inline-flex items-center gap-2 h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                                    }
                                  >
                                    {active ? <span className="text-xs leading-none">✓</span> : null}
                                    <span>{o.label}</span>
                                  </button>
                                );
                              };

                              if (isLangSubject) {
                                return (
                                  <>
                                    <div>
                                      <div className="text-xs font-medium text-neutral-600">Рівень мови</div>
                                      <div className="mt-2 flex flex-wrap gap-2">{primary.map(renderChip)}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-neutral-600">Для кого / ціль</div>
                                      <div className="mt-2 flex flex-wrap gap-2">{other.map(renderChip)}</div>
                                    </div>
                                  </>
                                );
                              }

                              const classLikeKeys = new Set(["school", "primary_1_4", "grade_5_9", "grade_10_11", "preschool"]);
                              const examLikeKeys = new Set(["dpa", "nmt", "olympiads"]);

                              const classes = all.filter((o) => classLikeKeys.has(o.key));
                              const exams = all.filter((o) => examLikeKeys.has(o.key));
                              const rest = all.filter((o) => !classLikeKeys.has(o.key) && !examLikeKeys.has(o.key));

                              return (
                                <>
                                  <div>
                                    <div className="text-xs font-medium text-neutral-600">Класи / програма</div>
                                    <div className="mt-2 flex flex-wrap gap-2">{classes.map(renderChip)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-neutral-600">Підготовка</div>
                                    <div className="mt-2 flex flex-wrap gap-2">{exams.map(renderChip)}</div>
                                  </div>
                                  {rest.length ? (
                                    <div>
                                      <div className="text-xs font-medium text-neutral-600">Додатково</div>
                                      <div className="mt-2 flex flex-wrap gap-2">{rest.map(renderChip)}</div>
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>
            <button
              type="button"
              onClick={() => {
                const uniq = new Set(subjectRows.map((r) => String(r.key || "").trim()).filter(Boolean));
                if (uniq.size >= 5) return;
                setSubjectRows((prev) => [...prev, { key: "", level: "b2" }]);
              }}
              disabled={new Set(subjectRows.map((r) => String(r.key || "").trim()).filter(Boolean)).size >= 5}
              className="mt-3 text-sm underline text-neutral-700 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Додати предмет
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Номер телефону (необовʼязково)</label>
            <div
              className={`flex h-11 rounded-xl border overflow-hidden bg-white shadow-sm ${
                stepErrors.phone ? "border-red-400" : "border-neutral-200"
              }`}
            >
              <div className="relative">
                <select
                  value={phoneCountry}
                  onChange={(e) => {
                    const cc = e.target.value;
                    setPhoneCountry(cc);
                    // re-validate phone on cc change
                    setStepErrors((p) => {
                      if (!p.phone) return p;
                      const { phone: _drop, ...rest } = p;
                      return rest;
                    });
                  }}
                  className="h-11 bg-white border-0 outline-none px-3 pr-8 text-sm appearance-none"
                  aria-label="Код країни телефону"
                >
                  {phoneCountryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-neutral-400">▾</div>
              </div>
              <div className="w-px bg-neutral-200" />
              <input
                value={formatPhoneDisplay(phone, phoneCountry)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digits = String(raw || "").replace(/\D/g, "");
                  const phoneRules: Record<string, { min: number; max: number }> = {
                    UA: { min: 9, max: 9 },
                    PL: { min: 9, max: 9 },
                    DE: { min: 10, max: 11 },
                    FR: { min: 9, max: 9 },
                    IT: { min: 9, max: 10 },
                    ES: { min: 9, max: 9 },
                    US: { min: 10, max: 10 },
                    GB: { min: 10, max: 10 },
                    CA: { min: 10, max: 10 },
                  };
                  const rule = phoneRules[phoneCountry] || { min: 6, max: 15 };
                  setPhone(digits.slice(0, rule.max));
                  setStep1SubmitError("");
                  setStepErrors((p) => {
                    if (!p.phone) return p;
                    const { phone: _drop, ...rest } = p;
                    return rest;
                  });
                }}
                placeholder="(xx) xxx xx xx"
                inputMode="numeric"
                ref={phoneRef}
                className="flex-1 px-3 text-sm border-0 outline-none"
              />
            </div>
            {stepErrors.phone ? <div className="mt-1 text-xs text-red-600">{stepErrors.phone}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="adult"
              type="checkbox"
              checked={adult}
              onChange={(e) => {
                setAdult(e.target.checked);
                setStep1SubmitError("");
                setStepErrors((p) => {
                  if (!p.adult) return p;
                  const { adult: _drop, ...rest } = p;
                  return rest;
                });
              }}
              ref={adultRef}
            />
            <label htmlFor="adult" className="text-sm">Мені точно більше 18</label>
          </div>

          {stepErrors.adult ? <div className="-mt-2 text-xs text-red-600">{stepErrors.adult}</div> : null}

        </section>
      )}

      {videoRecordOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="text-base font-semibold">Запис відео</div>
              <input
                type="button"
                value="×"
                onClick={() => closeVideoRecorder()}
                aria-label="Закрити"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  fontSize: 18,
                  fontWeight: 700,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
              />
            </div>

            <div className="px-5 py-5 space-y-4">
              {!!videoRecordError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{videoRecordError}</div>
              )}

              <div className="relative aspect-video w-full rounded-lg bg-black overflow-hidden">
                {recordedVideoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video src={recordedVideoUrl} className="w-full h-full object-cover" controls playsInline />
                ) : (
                  <video ref={liveVideoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                )}

                {videoStreamLoading && !recordedVideoUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
                    Підключення камери…
                  </div>
                ) : null}

                {videoRecording ? (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                    {(() => {
                      const elapsed = videoRecordSeconds;
                      const remaining = Math.max(0, VIDEO_MAX_SECONDS - videoRecordSeconds);
                      const fmt = (s: number) =>
                        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
                      return `REC ${fmt(elapsed)} · -${fmt(remaining)}`;
                    })()}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
              <div className="flex gap-2">
                <input
                  type="button"
                  value={videoRecording ? "Зупинити" : "Почати"}
                  onClick={() => (videoRecording ? stopVideoRecording() : startVideoRecording())}
                  disabled={videoUploading || (!videoRecording && !videoHasStream)}
                  style={{
                    background: "#ffffff",
                    color: "#111827",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "1px solid #e5e7eb",
                    cursor: videoUploading || (!videoRecording && !videoHasStream) ? "not-allowed" : "pointer",
                    opacity: videoUploading || (!videoRecording && !videoHasStream) ? 0.6 : 1,
                  }}
                />
                <input
                  type="button"
                  value="Пересняти"
                  onClick={() => openVideoRecorder()}
                  disabled={videoRecording || videoUploading}
                  style={{
                    background: "#ffffff",
                    color: "#111827",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "1px solid #e5e7eb",
                    cursor:
                      videoRecording || videoUploading
                        ? "not-allowed"
                        : "pointer",
                    opacity: videoRecording || videoUploading ? 0.6 : 1,
                  }}
                />
                <input
                  type="button"
                  value={videoUploading ? "Завантаження…" : "Завантажити"}
                  onClick={() => uploadRecordedVideo()}
                  disabled={!hasRecordedVideo || videoRecording || videoUploading}
                  style={{
                    background: "#111827",
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor:
                      !hasRecordedVideo || videoRecording || videoUploading ? "not-allowed" : "pointer",
                    opacity: !hasRecordedVideo || videoRecording || videoUploading ? 0.6 : 1,
                  }}
                />
              </div>

              <input
                type="button"
                value="Скасувати"
                onClick={() => closeVideoRecorder()}
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-center">Опис профілю</h2>
          <p className="text-sm text-neutral-600 text-center max-w-2xl mx-auto">
            Ця інформація буде розміщена у вашому публічному профілі. Напишіть її мовою, якою будете викладати.
          </p>

          <div className="max-w-2xl mx-auto space-y-6">
            <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" open={descActiveSection === 1}>
              <summary
                className="cursor-pointer flex items-center justify-between gap-3"
                onClick={(e) => {
                  e.preventDefault();
                  setDescActiveSection((prev) => (prev === 1 ? null : 1));
                }}
              >
                <span className="text-lg font-semibold text-neutral-900">{descText.s1Title}</span>
                {descAccepted.intro ? <span className="text-neutral-900">✓</span> : null}
              </summary>

              <div className="mt-3 space-y-3">
                <div className="text-sm text-neutral-600 leading-6">
                  {descText.s1Desc}
                </div>
                <textarea
                  value={profileIntro}
                  onFocus={() => setDescActiveSection(1)}
                  onChange={(e) => {
                    setProfileIntro(e.target.value);
                    setDescAccepted((p) => ({ ...p, intro: false }));
                  }}
                  rows={6}
                  placeholder={descText.s1Placeholder}
                  className={`w-full border rounded-xl px-4 py-3 text-sm leading-6 resize-vertical outline-none focus:ring-2 focus:ring-neutral-200 ${
                    !descAccepted.intro && descActiveSection === 1 ? "border-neutral-900" : "border-neutral-200"
                  }`}
                />
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-neutral-700 leading-6">
                  Не вказуйте своє прізвище та не подавайте інформацію у форматі резюме
                </div>
                {validateDescSection(profileIntro, 50).warnings.map((w) => (
                  <div key={w} className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-neutral-800 leading-6">
                    {w}
                  </div>
                ))}
                <div className="flex justify-start pt-1">
                  <input
                    type="button"
                    value="Продовжити"
                    onClick={() => {
                      const v = validateDescSection(profileIntro, 50);
                      if (!v.ok) return;
                      setDescAccepted((p) => ({ ...p, intro: true }));
                      setDescActiveSection(2);
                    }}
                    disabled={!validateDescSection(profileIntro, 50).ok}
                    style={{
                      background: "#111827",
                      color: "#ffffff",
                      borderRadius: 12,
                      padding: "12px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid #111827",
                      cursor: validateDescSection(profileIntro, 50).ok ? "pointer" : "not-allowed",
                      opacity: validateDescSection(profileIntro, 50).ok ? 1 : 0.6,
                    }}
                  />
                </div>
              </div>
            </details>

            <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" open={descActiveSection === 2}>
              <summary
                className="cursor-pointer flex items-center justify-between gap-3"
                onClick={(e) => {
                  e.preventDefault();
                  setDescActiveSection((prev) => (prev === 2 ? null : 2));
                }}
              >
                <span className="text-lg font-semibold text-neutral-900">{descText.s2Title}</span>
                {descAccepted.experience ? <span className="text-neutral-900">✓</span> : null}
              </summary>
              <div className="mt-3 space-y-3">
                <div className="text-sm text-neutral-600 leading-6">{descText.s2Desc}</div>
                <textarea
                  value={profileExperience}
                  onFocus={() => setDescActiveSection(2)}
                  onChange={(e) => {
                    setProfileExperience(e.target.value);
                    setDescAccepted((p) => ({ ...p, experience: false }));
                  }}
                  rows={4}
                  className={`w-full border rounded-xl px-4 py-3 text-sm leading-6 resize-vertical outline-none focus:ring-2 focus:ring-neutral-200 ${
                    !descAccepted.experience && descActiveSection === 2 ? "border-neutral-900" : "border-neutral-200"
                  }`}
                />
                {validateDescSection(profileExperience, 50).warnings.map((w) => (
                  <div key={w} className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-neutral-800 leading-6">
                    {w}
                  </div>
                ))}
                <div className="flex justify-start pt-1">
                  <input
                    type="button"
                    value="Продовжити"
                    onClick={() => {
                      const v = validateDescSection(profileExperience, 50);
                      if (!v.ok) return;
                      setDescAccepted((p) => ({ ...p, experience: true }));
                      setDescActiveSection(3);
                    }}
                    disabled={!validateDescSection(profileExperience, 50).ok}
                    style={{
                      background: "#111827",
                      color: "#ffffff",
                      borderRadius: 12,
                      padding: "12px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid #111827",
                      cursor: validateDescSection(profileExperience, 50).ok ? "pointer" : "not-allowed",
                      opacity: validateDescSection(profileExperience, 50).ok ? 1 : 0.6,
                    }}
                  />
                </div>
              </div>
            </details>

            <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" open={descActiveSection === 3}>
              <summary
                className="cursor-pointer flex items-center justify-between gap-3"
                onClick={(e) => {
                  e.preventDefault();
                  setDescActiveSection((prev) => (prev === 3 ? null : 3));
                }}
              >
                <span className="text-lg font-semibold text-neutral-900">{descText.s3Title}</span>
                {descAccepted.motivate ? <span className="text-neutral-900">✓</span> : null}
              </summary>
              <div className="mt-3 space-y-3">
                <div className="text-sm text-neutral-600 leading-6">{descText.s3Desc}</div>
                <textarea
                  value={profileMotivation}
                  onFocus={() => setDescActiveSection(3)}
                  onChange={(e) => {
                    setProfileMotivation(e.target.value);
                    setDescAccepted((p) => ({ ...p, motivate: false }));
                  }}
                  rows={4}
                  className={`w-full border rounded-xl px-4 py-3 text-sm leading-6 resize-vertical outline-none focus:ring-2 focus:ring-neutral-200 ${
                    !descAccepted.motivate && descActiveSection === 3 ? "border-neutral-900" : "border-neutral-200"
                  }`}
                />
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-neutral-700 leading-6">
                  Не вказуйте жодної інформації про безкоштовні пробні уроки або знижки, а також будь-які особисті контактні дані
                </div>
                {validateDescSection(profileMotivation, 50).warnings.map((w) => (
                  <div key={w} className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-neutral-800 leading-6">
                    {w}
                  </div>
                ))}
                <div className="flex justify-start pt-1">
                  <input
                    type="button"
                    value="Продовжити"
                    onClick={() => {
                      const v = validateDescSection(profileMotivation, 50);
                      if (!v.ok) return;
                      setDescAccepted((p) => ({ ...p, motivate: true }));
                      setDescActiveSection(4);
                    }}
                    disabled={!validateDescSection(profileMotivation, 50).ok}
                    style={{
                      background: "#111827",
                      color: "#ffffff",
                      borderRadius: 12,
                      padding: "12px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid #111827",
                      cursor: validateDescSection(profileMotivation, 50).ok ? "pointer" : "not-allowed",
                      opacity: validateDescSection(profileMotivation, 50).ok ? 1 : 0.6,
                    }}
                  />
                </div>
              </div>
            </details>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <input
              type="button"
              value="Назад"
              onClick={() => setStep(3)}
              style={{
                background: "#ffffff",
                color: "#111827",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 600,
                height: 44,
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                minWidth: 120,
              }}
            />
            <input
              type="button"
              value="Зберегти і продовжити"
              onClick={() => {
                const introV = validateDescSection(profileIntro, 50);
                const expV = validateDescSection(profileExperience, 50);
                const motV = validateDescSection(profileMotivation, 50);

                if (!descAccepted.intro) {
                  setDescActiveSection(1);
                  if (!introV.ok) return;
                  setDescAccepted((p) => ({ ...p, intro: true }));
                }
                if (!descAccepted.experience) {
                  setDescActiveSection(2);
                  if (!expV.ok) return;
                  setDescAccepted((p) => ({ ...p, experience: true }));
                }
                if (!descAccepted.motivate) {
                  setDescActiveSection(3);
                  if (!motV.ok) return;
                  setDescAccepted((p) => ({ ...p, motivate: true }));
                }

                saveAndNext({ profileIntro, profileExperience, profileMotivation }, 5);
              }}
              disabled={!(descAccepted.intro && descAccepted.experience && descAccepted.motivate)}
              style={{
                background: "#111827",
                color: "#ffffff",
                borderRadius: 12,
                padding: "12px 22px",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                height: 44,
                minWidth: 240,
                cursor: descAccepted.intro && descAccepted.experience && descAccepted.motivate ? "pointer" : "not-allowed",
                opacity: descAccepted.intro && descAccepted.experience && descAccepted.motivate ? 1 : 0.6,
              }}
            />
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-7">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold">Відеопривітання</h2>
            <div className="text-base text-neutral-600 max-w-5xl leading-7">
              <div className="text-xl font-semibold text-neutral-900">Додайте горизонтальне відео тривалістю до 2 хвилин</div>
              <div className="mt-1.5">
                Представтеся учням мовою, якою ви будете викладати. <span className="underline">Отримайте більше підказок щодо відео</span>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div className="space-y-5">
              <div className="aspect-video w-full rounded-2xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center shadow-sm">
                {videoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video src={videoUrl} className="w-full h-full object-cover" controls playsInline />
                ) : recordedVideoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video src={recordedVideoUrl} className="w-full h-full object-cover" controls playsInline />
                ) : (
                  <div className="text-sm text-neutral-500">Ваше відео з'явиться тут</div>
                )}
              </div>

              {!!videoMinDurationError && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-neutral-800">
                  {videoMinDurationError}
                </div>
              )}

              <div className="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold">Допомога з написання</div>
                  <span className="text-xs font-semibold rounded-full bg-neutral-100 text-neutral-700 px-2 py-0.5">Нове</span>
                </div>
                <div className="text-sm text-neutral-600 mt-1 leading-6">
                  Всього за кілька секунд отримайте автоматично згенерований сценарій на основі вашої інформації!
                </div>
                <div className="mt-4">
                  <input
                    type="button"
                    value="Почати запис"
                    onClick={() => openVideoRecorder()}
                    className="h-12 w-full rounded-xl text-sm font-semibold"
                    style={{
                      background: "#111827",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </div>

              <div className="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-base font-semibold">Спосіб 1: посилання на YouTube або Vimeo</div>
                <div className="mt-1 text-xs text-neutral-600">
                  <button
                    type="button"
                    onClick={() => setVideoUploadHelpOpen((v) => !v)}
                    className="max-w-full text-left text-xs font-medium text-neutral-700 underline whitespace-normal break-words"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    {videoUploadHelpOpen ? "Згорнути" : "Дізнайтеся, як завантажити відео на YouTube або Vimeo"}
                  </button>
                </div>

                {videoUploadHelpOpen ? (
                  <div className="mb-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-neutral-800">
                    <div className="font-medium mb-2">Як додати відео (коротко)</div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="font-semibold">1) YouTube</div>
                        <div className="text-neutral-700">Завантажте відео на YouTube та вставте посилання у поле вище.</div>
                      </div>
                      <div>
                        <div className="font-semibold">2) Vimeo</div>
                        <div className="text-neutral-700">Завантажте відео на Vimeo та вставте посилання у поле вище.</div>
                      </div>
                      <div>
                        <div className="font-semibold">3) Або завантажте файл</div>
                        <div className="text-neutral-700">Натисніть «Завантажити своє відео» і виберіть файл з компʼютера.</div>
                      </div>
                      <div className="pt-2 border-t border-blue-100">
                        <div className="font-semibold">Вимоги</div>
                        <div className="text-neutral-700">
                          Тривалість: до 2 хвилин. Формат: mp4/webm. Максимальний розмір: 60 MB.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="www.youtube.com/watch?v=..."
                  className="mt-3 w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-neutral-300"
                />
                {!!videoUrl.trim() &&
                  !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(videoUrl.trim()) &&
                  !/^https?:\/\/(res\.)?cloudinary\.com\//i.test(videoUrl.trim()) && (
                  <div className="mt-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-neutral-800">
                    Додайте посилання з YouTube/Vimeo або завантажте відео.
                  </div>
                )}
              </div>

              <div className="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-base font-semibold">Спосіб 2: завантажити файл</div>
                <div className="mt-1 text-xs text-neutral-600">
                  Завантажте готове відео з компʼютера.
                </div>
                <div className="mt-4">
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadVideoFile(f);
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,auto),minmax(0,1fr)] items-center gap-y-2 gap-x-4">
                    <input
                      type="button"
                      value={videoFileUploading ? "Завантаження…" : "Завантажити своє відео"}
                      onClick={() => videoFileInputRef.current?.click()}
                      disabled={videoFileUploading}
                      className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900"
                      style={{
                        cursor: videoFileUploading ? "not-allowed" : "pointer",
                        opacity: videoFileUploading ? 0.6 : 1,
                      }}
                    />
                    <div className="min-w-0 max-w-full text-xs text-neutral-500 leading-5 sm:justify-self-start whitespace-normal break-words">
                      Формат: <span className="font-medium text-neutral-700">MP4</span> або <span className="font-medium text-neutral-700">WEBM</span>
                      <span className="mx-1 text-neutral-400">·</span>
                      Макс. розмір: <span className="font-medium text-neutral-700 whitespace-nowrap">60 МБ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-2">
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5">
                <div className="text-base font-semibold">Вимоги до відео</div>
                <div className="text-sm text-neutral-600 mt-1 leading-6">Переконайтеся, що ваше відео відповідає вимогам для схвалення</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-neutral-900">✓</span>
                  <div>
                    <div className="text-base font-semibold">Варто</div>
                    <ul className="mt-2 text-[15px] leading-6 text-neutral-700 space-y-1.5">
                      <li>Тривалість відео повинна бути від 30 секунд до 2 хвилин</li>
                      <li>Записувати відео в горизонтальному форматі та на рівні очей</li>
                      <li>Забезпечити хороше освітлення і нейтральний фон</li>
                      <li>Використовувати стійку поверхню, щоб зображення не тремтіло</li>
                      <li>Доброзичливо привітати учнів і запросити їх на урок</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-red-600">×</span>
                  <div>
                    <div className="text-base font-semibold">Не варто</div>
                    <ul className="mt-2 text-[15px] leading-6 text-neutral-700 space-y-1.5">
                      <li>Вказувати своє прізвище або будь-яку контактну інформацію</li>
                      <li>Додавати логотипи та посилання</li>
                      <li>Використовувати слайдшоу та презентації</li>
                      <li>Показувати на відео сторонніх людей</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <input
              type="button"
              value="Назад"
              onClick={() => setStep(4)}
              style={{
                background: "#ffffff",
                color: "#111827",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 600,
                height: 44,
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                minWidth: 120,
              }}
            />
            <input
              type="button"
              value="Зберегти і продовжити"
              onClick={() => {
                setVideoRecordError("");
                const url = String(videoUrl || "").trim();
                if (
                  url &&
                  !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(url) &&
                  !/^https?:\/\/(res\.)?cloudinary\.com\//i.test(url)
                ) {
                  setVideoRecordError("Додайте посилання з YouTube/Vimeo або завантажте відео.");
                  return;
                }
                setVideoMinDurationError("");
                saveAndNext({ videoUrl: url }, 6);
              }}
              disabled={
                !!videoUrl.trim() &&
                !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(videoUrl.trim()) &&
                !/^https?:\/\/(res\.)?cloudinary\.com\//i.test(videoUrl.trim())
              }
              style={{
                background: "#111827",
                color: "#ffffff",
                borderRadius: 12,
                padding: "12px 22px",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                height: 44,
                minWidth: 240,
                cursor:
                  !!videoUrl.trim() &&
                  !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(videoUrl.trim()) &&
                  !/^https?:\/\/(res\.)?cloudinary\.com\//i.test(videoUrl.trim())
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !!videoUrl.trim() &&
                  !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(videoUrl.trim()) &&
                  !/^https?:\/\/(res\.)?cloudinary\.com\//i.test(videoUrl.trim())
                    ? 0.6
                    : 1,
              }}
            />
          </div>
        </section>
      )}

      {photoEditOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="text-base font-semibold">Отредагуйте фото</div>
              <input
                type="button"
                value="×"
                onClick={() => {
                  setPhotoEditOpen(false);
                  setPhotoEditFile(null);
                }}
                aria-label="Закрити"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  fontSize: 18,
                  fontWeight: 700,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
              />
            </div>

            <div className="px-5 py-5">
              {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-center">
                <canvas
                  ref={photoEditCanvasRef}
                  className="rounded-lg bg-neutral-100 touch-none"
                  onPointerDown={(e) => {
                    const canvas = photoEditCanvasRef.current;
                    if (!canvas) return;
                    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                    setPhotoEditDragging(true);
                    photoEditDragStartRef.current = {
                      x: e.clientX,
                      y: e.clientY,
                      ox: photoEditOffset.x,
                      oy: photoEditOffset.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    if (!photoEditDragging) return;
                    const start = photoEditDragStartRef.current;
                    if (!start) return;
                    const dx = e.clientX - start.x;
                    const dy = e.clientY - start.y;
                    setPhotoEditOffset({ x: start.ox + dx, y: start.oy + dy });
                  }}
                  onPointerUp={() => {
                    setPhotoEditDragging(false);
                    photoEditDragStartRef.current = null;
                  }}
                  onPointerCancel={() => {
                    setPhotoEditDragging(false);
                    photoEditDragStartRef.current = null;
                  }}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Збільшити</div>
                  <input
                    type="range"
                    min={1}
                    max={2.2}
                    step={0.05}
                    value={photoEditZoom}
                    onChange={(e) => setPhotoEditZoom(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Повернути</div>
                  <div className="flex gap-2">
                    <input
                      type="button"
                      value="⟲"
                      onClick={() => setPhotoEditRotate((r) => r - 90)}
                      style={{
                        background: "#ffffff",
                        color: "#111827",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        border: "1px solid #e5e7eb",
                        cursor: "pointer",
                      }}
                    />
                    <input
                      type="button"
                      value="⟳"
                      onClick={() => setPhotoEditRotate((r) => r + 90)}
                      style={{
                        background: "#ffffff",
                        color: "#111827",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        border: "1px solid #e5e7eb",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <input
                type="button"
                value="Скасувати"
                onClick={() => {
                  setPhotoEditOpen(false);
                  setPhotoEditFile(null);
                  setPhotoEditDragging(false);
                  photoEditDragStartRef.current = null;
                }}
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
              />
              <input
                type="button"
                value={photoUploading ? "Завантаження…" : "Зберегти фото профіля"}
                onClick={() => {
                  if (!photoEditFile) return;
                  uploadCroppedPhoto(photoEditFile);
                }}
                disabled={!photoEditFile || photoUploading}
                style={{
                  background: "#111827",
                  color: "#ffffff",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  minWidth: 220,
                  cursor: !photoEditFile || photoUploading ? "not-allowed" : "pointer",
                  opacity: !photoEditFile || photoUploading ? 0.6 : 1,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Фото профіля</h2>
          <p className="text-sm text-neutral-600">Виберіть фото, яке допоможе учням краще вас впізнати.</p>

          <div
            ref={photoBlockRef}
            className={`border rounded-xl p-4 bg-white ${step2SubmitError ? "border-red-300" : ""}`}
            tabIndex={-1}
          >
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Фото профіля" className="h-16 w-16 rounded-lg object-cover bg-neutral-200" />
              ) : (
                <div className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center text-xs text-neutral-500">
                  JPG/PNG<br />
                  5MB
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Ваш профіль"}
                </div>
                <div className="text-sm text-neutral-600">Предмети: {subjects.join(", ") || "—"}</div>
                <div className="text-sm text-neutral-600">
                  Мови: {langRows.map((r) => `${r.code.toUpperCase()} (${r.level.toUpperCase()})`).join(", ") || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="inline-flex items-center justify-center w-full rounded-lg border px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-neutral-50">
              <span>{photoUrl ? "Завантажити нове фото" : "Завантажити фото"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoEditFile(file);
                  setPhotoEditZoom(1.1);
                  setPhotoEditRotate(0);
                  setPhotoEditOffset({ x: 0, y: 0 });
                  setPhotoEditOpen(true);
                }}
              />
            </label>
            {photoUploading && <div className="mt-2 text-xs text-neutral-600">Завантаження…</div>}
            {!photoUploading && photoFileName && <div className="mt-2 text-xs text-neutral-600">Файл: {photoFileName}</div>}
          </div>

          <div className="mt-6">
            <div className="flex flex-col items-center">
              <div className="text-base font-semibold text-neutral-900 mb-3 text-center">Яким повинно бути фото</div>
              <div className="flex justify-center gap-3 mb-4">
                {photoExamples.map((src) => (
                  <div
                    key={src}
                    className="relative w-20 h-20 rounded-2xl overflow-hidden bg-neutral-100 ring-1 ring-black/5 shadow-sm"
                  >
                    <NextImage
                      src={src}
                      alt="Приклад фото"
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <div className="w-full max-w-md space-y-2.5 text-[15px] text-neutral-800">
                {photoRules.map((rule) => (
                  <div key={rule} className="flex items-start gap-3">
                    <span className="mt-0.5 text-neutral-900">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42.002L3.29 9.27a1 1 0 1 1 1.42-1.4l3.04 3.086 6.54-6.58a1 1 0 0 1 1.414-.006Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <div className="leading-6 text-neutral-700">{rule}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </section>
      )}

      {/* Bottom action bar (like Preply) */}
      {step === 1 || step === 2 ? (
        <div className="mt-8 border-t pt-6">
          <div className="flex justify-center gap-3">
            {step === 2 ? (
              <input
                type="button"
                value="Назад"
                onClick={() => setStep(1)}
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  borderRadius: 12,
                  padding: "12px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  height: 44,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                  minWidth: 120,
                }}
              />
            ) : (
              null
            )}

            {step === 1 ? (
              <input
                type="button"
                value="Зберегти і продовжити"
                onClick={() => {
                  const { ok, errs } = validateStep(1);
                  if (!ok) {
                    const order: Array<{ key: string; ref: React.RefObject<HTMLElement> }> = [
                      { key: "firstName", ref: firstNameRef as any },
                      { key: "lastName", ref: lastNameRef as any },
                      { key: "country", ref: countryRef as any },
                      { key: "subjects", ref: firstSubjectRef as any },
                      { key: "phone", ref: phoneRef as any },
                      { key: "adult", ref: adultRef as any },
                    ];
                    const firstKey = order.find((x) => !!errs[x.key])?.key || Object.keys(errs)[0];
                    if (firstKey) setStep1SubmitError(String(errs[firstKey] || "Перевірте обовʼязкові поля."));

                    const target = order.find((x) => x.key === firstKey)?.ref?.current as any;
                    if (target) {
                      try {
                        target.scrollIntoView({ behavior: "smooth", block: "center" });
                      } catch {
                        // ignore
                      }
                      try {
                        target.focus?.();
                      } catch {
                        // ignore
                      }
                    }
                    return;
                  }
                  const langCodes = langRows.map((r) => r.code).filter(Boolean);
                  const languageLevels: Record<string, string> = {};
                  for (const r of langRows) {
                    if (r.code && r.level) languageLevels[r.code] = r.level;
                  }

                  const subjects = Array.from(new Set(subjectRows.map((r) => r.key).filter(Boolean)));
                  const subjectLevelRows = subjectRows
                    .map((r) => ({ key: String(r.key || "").trim(), level: String(r.level || "").trim() }))
                    .filter((r) => !!r.key && !!r.level);

                  saveAndNext(
                    {
                      firstName,
                      lastName,
                      country,
                      subjects,
                      subjectLevelRows,
                      directionsBySubject,
                      languages: langCodes,
                      languageLevels,
                      phone,
                      phoneCountry,
                      adult,
                    },
                    2,
                  );
                }}
                disabled={false}
                style={{
                  background: "#111827",
                  color: "#ffffff",
                  borderRadius: 12,
                  padding: "12px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  height: 44,
                  minWidth: 240,
                  cursor: "pointer",
                  opacity: 1,
                }}
              />
            ) : (
              <input
                type="button"
                value="Зберегти і продовжити"
                onClick={() => {
                  if (!photoUrl) {
                    setStep2SubmitError("Додайте фото профіля (обличчя має бути видно).");
                    const el = photoBlockRef.current as any;
                    if (el) {
                      try {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      } catch {
                        // ignore
                      }
                      try {
                        el.focus?.();
                      } catch {
                        // ignore
                      }
                    }
                    return;
                  }
                  setStep2SubmitError("");
                  saveAndNext({ photoUrl: photoUrl || null }, 3);
                }}
                disabled={false}
                style={{
                  background: "#111827",
                  color: "#ffffff",
                  borderRadius: 12,
                  padding: "12px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  height: 44,
                  minWidth: 240,
                  cursor: "pointer",
                  opacity: 1,
                }}
              />
            )}
          </div>
          {step === 1 && step1SubmitError ? (
            <div className="mt-3 flex justify-center">
              <div className="max-w-xl w-full rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {step1SubmitError}
              </div>
            </div>
          ) : null}
          {step === 2 && step2SubmitError ? (
            <div className="mt-3 flex justify-center">
              <div className="max-w-xl w-full rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {step2SubmitError}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Сертифікація викладання</h2>
          <p className="text-sm text-neutral-600">
            У вас є сертифікати викладання? Якщо так, опишіть їх, щоб підвищити довіру до вашого профілю та залучити більше студентів.
          </p>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={noTeachingCertificate}
              onChange={(e) => setNoTeachingCertificate(e.target.checked)}
              className="h-4 w-4"
            />
            У мене немає сертифіката викладача
          </label>

          {!noTeachingCertificate && (
            <div className="space-y-4">
              {certRows.map((row, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Предмет</div>
                    {certRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setCertRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-sm text-neutral-500 hover:text-neutral-800"
                        aria-label="Видалити"
                        title="Видалити"
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>

                  <select
                    value={row.subject}
                    onChange={(e) =>
                      setCertRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r)),
                      )
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Оберіть</option>
                    {subjectOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Сертифікат</label>
                    <input
                      value={row.certificate}
                      onChange={(e) =>
                        setCertRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, certificate: e.target.value } : r)),
                        )
                      }
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Опис</label>
                    <input
                      value={row.description}
                      onChange={(e) =>
                        setCertRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)),
                        )
                      }
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Видано</label>
                    <input
                      value={row.issuedBy}
                      onChange={(e) =>
                        setCertRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, issuedBy: e.target.value } : r)),
                        )
                      }
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Роки навчання</label>
                    <div className="flex gap-3">
                      <select
                        value={row.fromYear}
                        onChange={(e) =>
                          setCertRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, fromYear: e.target.value } : r)),
                          )
                        }
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        {yearOptions.map((y) => (
                          <option key={`from-${y}`} value={y}>
                            {y || "Вибрати"}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.toYear}
                        onChange={(e) =>
                          setCertRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, toYear: e.target.value } : r)),
                          )
                        }
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        {yearOptions.map((y) => (
                          <option key={`to-${y}`} value={y}>
                            {y || "Вибрати"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-neutral-50 border p-4">
                    <div className="text-sm font-semibold">Завантажте сертифікат</div>
                    <div className="text-sm text-neutral-600 mt-1">Наша команда вручну перевірить подані документи</div>

                    <div className="mt-3">
                      <label className="block">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCertUploadError("");
                            setCertUploadingIndex(idx);
                            try {
                              const fd = new FormData();
                              fd.append("file", file);
                              const res = await fetch("/api/teacher/upload-resume", { method: "POST", body: fd });
                              if (!res.ok) {
                                let details = "";
                                try {
                                  const j = (await res.json()) as any;
                                  details = String(j?.details || j?.error || "");
                                } catch {
                                  try {
                                    details = await res.text();
                                  } catch {
                                    details = "";
                                  }
                                }
                                throw new Error(details ? `Не вдалося завантажити сертифікат: ${details}` : "Не вдалося завантажити сертифікат");
                              }
                              const data = (await res.json()) as any;
                              const url = String(data?.url || "");
                              if (!url) throw new Error("Не вдалося отримати посилання на файл");
                              setCertRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, fileUrl: url, fileName: file.name } : r)),
                              );
                            } catch (err: any) {
                              setCertUploadError(err?.message || "Помилка завантаження сертифіката");
                            } finally {
                              setCertUploadingIndex(null);
                              try {
                                e.target.value = "";
                              } catch {
                                // ignore
                              }
                            }
                          }}
                        />
                        <span
                          className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
                          style={{ cursor: certUploadingIndex === idx ? "not-allowed" : "pointer", opacity: certUploadingIndex === idx ? 0.6 : 1 }}
                        >
                          {certUploadingIndex === idx ? "Завантаження…" : "Завантажити"}
                        </span>
                      </label>
                    </div>

                    <div className="mt-3 rounded-lg bg-sky-50 border border-sky-100 p-3 text-sm text-neutral-700">
                      Приймаються тільки справжні документи. Надання неправдивої інформації може призвести до відхилення або блокування вашого облікового запису.
                    </div>

                    <div className="mt-2 text-sm text-neutral-600">Формат JPG або PNG; максимальний розмір — 20 МБ.</div>

                    {!!row.fileUrl && (
                      <div className="mt-2 text-sm text-neutral-800">
                        Файл: <a className="underline" href={row.fileUrl} target="_blank" rel="noreferrer">{row.fileName || "відкрити"}</a>
                      </div>
                    )}
                  </div>

                  {idx < certRows.length - 1 ? <div className="pt-2 border-t" /> : null}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setCertRows((prev) => [
                    ...prev,
                    { subject: "", certificate: "", description: "", issuedBy: "", fromYear: "", toYear: "", fileUrl: "", fileName: "" },
                  ])
                }
                className="text-sm font-medium underline underline-offset-4"
              >
                Додати ще один сертифікат
              </button>
            </div>
          )}

          {!!certUploadError && <div className="text-sm text-red-600">{certUploadError}</div>}

          <div className="mt-6 flex justify-center gap-3">
            <input
              type="button"
              value="Назад"
              onClick={() => setStep(2)}
              style={{
                background: "#ffffff",
                color: "#111827",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 600,
                height: 44,
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                minWidth: 120,
              }}
            />
            <input
              type="button"
              value="Зберегти і продовжуйте"
              onClick={() => {
                const cleaned = certRows
                  .map((r) => ({
                    subject: String(r.subject || "").trim(),
                    certificate: String(r.certificate || "").trim(),
                    description: String(r.description || "").trim(),
                    issuedBy: String(r.issuedBy || "").trim(),
                    fromYear: String(r.fromYear || "").trim(),
                    toYear: String(r.toYear || "").trim(),
                    fileUrl: String(r.fileUrl || "").trim(),
                    fileName: String(r.fileName || "").trim(),
                  }))
                  .filter((r) => Object.values(r).some((v) => String(v).trim().length > 0));

                saveAndNext(
                  {
                    noTeachingCertificate,
                    certifications: noTeachingCertificate ? [] : cleaned,
                  },
                  4,
                );
              }}
              style={{
                background: "#111827",
                color: "#ffffff",
                borderRadius: 12,
                padding: "12px 22px",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                height: 44,
                minWidth: 240,
                cursor: "pointer",
              }}
            />
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-6 max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight">Розклад</h2>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-neutral-600 leading-6">
              Весь час у розкладі буде відображатися у вашому часовому поясі.
            </div>

            <div className="mt-4 max-w-xl">
              <TimeZonePicker
                value={scheduleTimezone || ""}
                onChange={(v) => {
                  setScheduleTimezone(v);
                  setScheduleCity((prev) => prev || tzToCity(v));
                }}
                locale={descLocale === "ru" ? "ru-RU" : descLocale === "en" ? "en-US" : "uk-UA"}
                label="Часовий пояс"
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xl font-semibold">Створіть свій розклад</div>
            <div className="mt-1 text-sm text-neutral-600">
              У розкладі відображається ваш робочий час. Учні можуть бронювати уроки в цей час.
            </div>
          </div>

          <div className="max-w-2xl rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-neutral-800">
            <div className="font-medium">Додайте пікові години й отримуйте більше учнів</div>
            <div className="mt-1 text-neutral-700">
              Учні часто бронюють уроки у період між 21:00 і 24:00. Додайте цей піковий час у свій графік, щоб збільшити шанси на бронювання уроку.
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={scheduleSkip}
              onChange={(e) => setScheduleSkip(e.target.checked)}
              className="h-4 w-4 accent-black"
            />
            Налаштую пізніше
          </label>

          {!scheduleSkip && (
            <div className="space-y-4 max-w-2xl">
              {scheduleUpcomingCount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-medium">У вас є заплановані уроки</div>
                  <div className="mt-1 text-amber-900/90">
                    Зміни розкладу діють лише для нових бронювань. Вже заплановані уроки не переносяться.
                    {scheduleUpcomingNextISO ? (
                      <span className="block mt-1 text-xs text-amber-900/80">Найближчий урок: {new Date(scheduleUpcomingNextISO).toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <TutorScheduleSlotPicker selected={scheduleSelectedSlots} setSelected={setScheduleSelectedSlots} blockMinutes={60} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(5)}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                const tz = scheduleTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
                const city = scheduleCity || tzToCity(tz);
                try {
                  // сохраняем timezone/city в анкете (tracks)
                  await saveAndNext({ timezone: tz, city });

                  if (!scheduleSkip) {
                    if (scheduleUpcomingCount > 0) {
                      const ok = window.confirm(
                        "У вас є заплановані уроки. Зміни розкладу вплинуть лише на майбутні бронювання. Вже заплановані уроки не будуть перенесені. Продовжити?",
                      );
                      if (!ok) return;
                    }

                    const windows = slotSetToWindows(scheduleSelectedSlots, tz, 30, 60).filter((w) => w.endMin > w.startMin);

                    if (!windows.length) {
                      setError("Оберіть принаймні один день та час, або позначте «Налаштую пізніше». ");
                      return;
                    }

                    await fetch(`/api/tutors/${encodeURIComponent(tutor.id)}/availability`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ windows, timezone: tz, userId: tutor.userId }),
                    });
                  }
                  setStep(7);
                } catch (e: any) {
                  setError(e?.message || "Не вдалося зберегти розклад");
                }
              }}
              className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Далі
            </button>
          </div>
        </section>
      )}

      {step === 7 && (
        <section className="space-y-6 max-w-3xl mx-auto">
          {submitted ? (
            <>
              <h2 className="text-3xl font-semibold tracking-tight">Дякуємо!</h2>
              <p className="text-sm text-neutral-700 max-w-2xl">
                Ваша анкета була відправлена на обробку. Як тільки ми перевіримо її, ми повідомимо вам результат.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/profile`)}
                  className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Перейти до профілю
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-tight">Встановіть ціну 50-хвилинного уроку</h2>

              <p className="text-sm text-neutral-600 max-w-2xl">
                Пропонуючи конкурентоспроможну ціну, ви зможете залучати більше учнів. Після того, як ви успішно проведете
                кілька перших уроків, сміливо коригуйте цю ціну відповідно до своїх цілей.
              </p>

              {error ? (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-neutral-800">{error}</div>
              ) : null}

              {(() => {
                const recommendedByCurrency: Record<string, number> = { USD: 8, EUR: 8, UAH: 300 };
                const ccy = currency || "UAH";
                const rec = recommendedByCurrency[ccy] ?? 300;

                const commissionRows = [
                  { hours: "0–20 годин", pct: 25 },
                  { hours: "21–50 годин", pct: 20 },
                  { hours: "51–200 годин", pct: 17 },
                  { hours: "201–400 годин", pct: 14 },
                  { hours: "400+ годин", pct: 12 },
                ];

                return (
                  <>
                    <div className="text-sm text-neutral-700">
                      Щоб допомогти вам почати, рекомендуємо встановити ціну уроку в розмірі <b>{rec}</b> {ccy}
                    </div>

                    <div className="max-w-xl mx-auto">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="text-sm font-medium">Ваша ціна за урок</div>
                        <div className="mt-2 flex gap-3">
                          <div className="relative w-[140px]">
                            <select
                              value={currency}
                              onChange={(e) => setCurrency(e.target.value)}
                              className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none"
                            >
                              <option value="UAH">UAH</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
                          </div>

                          <div className="relative flex-1">
                            <input
                              value={rate}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const cleaned = raw.replace(/[^0-9.,]/g, "");
                                setRate(cleaned);
                              }}
                              inputMode="decimal"
                              placeholder={String(rec)}
                              className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                            />
                          </div>
                        </div>

                        {!freeFirstLesson ? (
                          <div className="mt-4">
                            <div className="text-sm font-medium">Ціна за 30 хв (опціонально)</div>
                            <div className="mt-2 flex gap-3">
                              <div className="relative w-[140px]">
                                <select
                                  value={currency}
                                  onChange={(e) => setCurrency(e.target.value)}
                                  className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none"
                                >
                                  <option value="UAH">UAH</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
                              </div>

                              <div className="relative flex-1">
                                <input
                                  value={rate30}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const cleaned = raw.replace(/[^0-9.,]/g, "");
                                    setRate30(cleaned);
                                  }}
                                  inputMode="decimal"
                                  placeholder=""
                                  className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-neutral-500">Ви можете вказати будь-яку ціну у UAH, USD або EUR.</div>

                        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                          <label className="flex items-start gap-3 text-sm text-neutral-900">
                            <input
                              type="checkbox"
                              checked={freeFirstLesson}
                              onChange={(e) => setFreeFirstLesson(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold">Перший урок безкоштовний</span>
                              <span className="block text-xs text-neutral-600">
                                Учень зможе забронювати перший урок з вами без оплати (але не більше 3 безкоштовних уроків загалом по сервісу).
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="max-w-2xl mx-auto rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-neutral-800">
                      <div className="font-medium">Порада</div>
                      <div className="mt-1 text-neutral-700">
                        Репетитори, які дотримуються наших рекомендацій, зазвичай швидше отримують перші бронювання.
                      </div>
                    </div>

                    <details className="max-w-2xl mx-auto rounded-xl border border-neutral-200 bg-white px-4 py-3">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-900">
                        Комісія платформи
                      </summary>
                      <div className="mt-3 text-sm text-neutral-700 space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5">✓</span>
                            <span>За наступні уроки комісія знижується залежно від кількості проведених годин.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5">✓</span>
                            <span>Чим більше годин викладаєте, тим нижчий відсоток комісії.</span>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-neutral-200">
                          <div className="grid grid-cols-2 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-600">
                            <div>Завершені години</div>
                            <div className="text-right">Розмір комісії</div>
                          </div>
                          {commissionRows.map((r) => (
                            <div key={r.hours} className="grid grid-cols-2 px-4 py-3 text-sm">
                              <div className="text-neutral-800">{r.hours}</div>
                              <div className="text-right font-semibold text-neutral-900">{r.pct}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>

                    <div className="mt-6 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(6)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      >
                        Назад
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          const v = validateBeforeSubmit();
                          if (v) {
                            setError(v);
                            return;
                          }
                          const cleaned = String(rate || "").replace(/,/g, ".").trim();
                          const n = Number(cleaned);
                          const cleaned30 = String(rate30 || "").replace(/,/g, ".").trim();
                          const n30 = Number(cleaned30);
                          try {
                            await saveAndNext({
                              ratePerLesson: n,
                              ratePerLesson30:
                                freeFirstLesson ? undefined : Number.isFinite(n30) && n30 > 0 ? n30 : undefined,
                              currency,
                              freeFirstLesson,
                              submitForModeration: true,
                            });
                            setSubmitted(true);
                          } catch (e: any) {
                            setError(e?.message || "Не вдалося зберегти ціну");
                          }
                        }}
                        className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-neutral-800"
                      >
                        Завершити реєстрацію
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </section>
      )}
    </main>
  );
}
