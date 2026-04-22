import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import wasdImg from "../assets/wasd.png";
import beachesImg from "../assets/beaches.png";
import hawaiiImg from "../assets/hawaii.png";
import nlpImg from "../assets/nlp.png";
import pixImg from "../assets/pix.png";
import speImg from "../assets/spe.png";
import vinImg from "../assets/vin.png";
import titleImg from "../assets/titletext.png";

// CONFIG
const SPRING = { type: "spring" as const, stiffness: 275, damping: 30 };
const SCROLL_THRESHOLD = 150;
const REST_WIDTH_RATIO = 0.07;  // rest slices: 7% of vw
const REST_HEIGHT_RATIO = 0.5;  // rest slices: 50% of vh
const GAP_RATIO = 0.01;        // gap: 1% of vw

// link positions for contact slide
type LinkPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

type ProjectLink = {
  label: string;
  url: string;
  position: LinkPosition;
};

const LINK_POSITIONS: Record<LinkPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

// SOURE OF TRUTH

type Project = {
  title: string;
  width: number;      // fraction of vw (e.g. 0.35 = 35%)
  height: number;     // fraction of vh (e.g. 0.45 = 45%)
  color: string;      // hex color (e.g. "#e63946")
  imgUrl?: string;    // optional image to show in active slice
  imgScale?: number;  // 0-1, image size relative to slice (default 0.5)
  links?: ProjectLink[];
  content?: string;
  onClick?: () => void;
};

const wasdOnClick = () => {
  window.open("https://x4kuhd.github.io/wasd_cat/", "_blank", "noopener,noreferrer");
}

const PROJECTS: Project[] = [

  { title: "Use arrow keys or scroll wheel for navigation", width: 0.5, height: 0.8, color: "#ffffff", imgUrl: titleImg, imgScale: 0.8 },

  { title: "Pix", width: 0.3, height: 0.8, color: "#515A5D", imgUrl: pixImg },

  { title: "Client HR Automation @ IBM CE", width: 0.5, height: 0.8, color: "#008BF6", imgUrl: speImg },

  { title: "Vineyard", width: 0.3, height: 0.8, color: "#BB85C5", imgUrl: vinImg },

  { title: "WASD Cat", width: 0.3, height: 0.8, color: "#FBDB8A", imgUrl: wasdImg, onClick: wasdOnClick  },

  { title: "Beaches App", width: 0.3, height: 0.8, color: "#04A7E6", imgUrl: beachesImg },

  { title: "Client NLP Dashboard @ IBM CE", width: 0.5, height: 0.8, color: "#306DFF", imgUrl: nlpImg },

  { title: "Government Tourism Survey @ IBM CE", width: 0.3, height: 0.8, color: "#EEC800", imgUrl: hawaiiImg },
  
  // { title: "Wow I should hire him",  width: 0.5, height: 0.8, color: "#49D650" },

  {
    title: "Contacts and Links", width: 0.5, height: 0.8, color: "#151515", links: [
      { label: "GitHub", url: "https://github.com/x4kUHD", position: "top-left" },
      { label: "© 2026", url: "#", position: "top-right" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/yeonwook-kim/", position: "center" },
      { label: "Twitter", url: "https://x.com/eirocw", position: "bottom-left" },
      { label: "Spotify", url: "https://open.spotify.com/user/ukjq1ke3k359dnpumtd5o8xbd?si=c7c92ac838eb44c1", position: "bottom-right" },
    ]
  },
];

const SLICE_COUNT = PROJECTS.length;

// HELPERS
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function getWidth(i: number, active: number, vw: number) {
  return i === active ? Math.max(400, PROJECTS[active].width * vw) : REST_WIDTH_RATIO * vw;
}

function getHeight(i: number, active: number, vh: number) {
  const activeH = PROJECTS[active].height * vh;
  return i === active ? activeH : REST_HEIGHT_RATIO * vh;
}

function getGap(vw: number, isMobile: boolean = false) {
  return isMobile ? 32 : GAP_RATIO * vw;
}

function getMobileWidth(vp: { w: number, h: number }) {
  return Math.min(0.7 * vp.w, 0.7 * vp.h);
}

function getMobileHeight(i: number, active: number, vp: { w: number, h: number }, gap: number) {
  const activeSize = getMobileWidth(vp);
  if (i === active) return activeSize;
  return Math.max(20, (vp.h - activeSize) / 2 - gap);
}

function getCenterOffsetY(active: number, vp: { w: number, h: number }, gap: number) {
  let off = 0;
  for (let i = 0; i < active; i++) off += getMobileHeight(i, active, vp, gap) + gap;
  off += getMobileHeight(active, active, vp, gap) / 2;
  return vp.h / 2 - off;
}

// hex → [r, g, b]s
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// linearly interpolates between base color (a) and target color (b) based on ratio (t)
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// gradient radiates from active slice: left → lighter, right → darker
function getColor(i: number, active: number): string {
  const base = hexToRgb(PROJECTS[active].color);
  if (i === active) return PROJECTS[active].color;

  const dist = i - active; // negative = left, positive = right
  const maxDist = Math.max(active, SLICE_COUNT - 1 - active) || 1;
  const t = Math.min(Math.abs(dist) / maxDist, 1) * 0.85; // cap at 85% blend

  if (dist < 0) return mix(base, [255, 255, 255], t); // left → lighter
  return mix(base, [0, 0, 0], t);                      // right → darker
}

// calculates x-offset to set "active" to center based on "vw"
function getCenterOffset(active: number, vw: number, isMobile: boolean = false) {
  const gap = getGap(vw, isMobile);
  let off = 0;
  for (let i = 0; i < active; i++) off += getWidth(i, active, vw) + gap;
  off += getWidth(active, active, vw) / 2;

  return vw / 2 - off;
}

// COMPONENT
export default function ScrollStrip() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [vp, setVp] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1400,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  });

  // scroll accumulator
  const scrollAcc = useRef(0);

  // useEffect(fn, []) -> on mount (when component first appears )

  // window resize handler 
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // scroll handler  
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollAcc.current += e.deltaY;
      if (Math.abs(scrollAcc.current) >= SCROLL_THRESHOLD) {
        const dir = scrollAcc.current > 0 ? 1 : -1;
        scrollAcc.current = 0;
        setActiveIndex((p) => clamp(p + dir, 0, SLICE_COUNT - 1));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // arrow key handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActiveIndex((p) => Math.min(p + 1, SLICE_COUNT - 1));
      if (e.key === "ArrowLeft") setActiveIndex((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isMobile = vp.w < 1000;

  // gap and x/y transform
  const gap = getGap(vp.w, isMobile);
  const tx = getCenterOffset(activeIndex, vp.w, isMobile);
  const ty = getCenterOffsetY(activeIndex, vp, gap);

  // progress bar sizing
  const DOT_SIZE = 10;
  const DOT_GAP = 6;
  const activeBoxSize = isMobile ? getMobileWidth(vp) : getWidth(activeIndex, activeIndex, vp.w);
  const inactiveDotsTotal = (SLICE_COUNT - 1) * DOT_SIZE + (SLICE_COUNT - 1) * DOT_GAP;
  const activeDotSize = Math.max(DOT_SIZE, activeBoxSize - inactiveDotsTotal);

  const ChevronUp = () => (
    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );

  const ChevronDown = () => (
    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );

  return (
    <div className={`relative h-full w-full flex ${isMobile ? 'flex-col items-center justify-start' : 'items-center'} overflow-hidden`}>

      {/* ambient background glow */}
      {!isMobile && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ 
            width: '100vw', 
            height: '100vh', 
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)'
          }}
          animate={{ backgroundColor: PROJECTS[activeIndex].color, opacity: 0.3 }}
          transition={SPRING}
        />
      )}

      {/* progress bar */}
      <div className={`absolute z-50 ${isMobile ? 'left-4 top-1/2 -translate-y-1/2 flex-col' : 'bottom-8 left-1/2 -translate-x-1/2 flex-row'} flex items-center`} style={{ gap: `${DOT_GAP}px` }}>
        {PROJECTS.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              width: isMobile ? DOT_SIZE : (i === activeIndex ? activeDotSize : DOT_SIZE),
              height: isMobile ? (i === activeIndex ? activeDotSize : DOT_SIZE) : DOT_SIZE,
              backgroundColor: getColor(i, activeIndex),
            }}
            transition={SPRING}
          />
        ))}
      </div>

      {/* strip */}
      <motion.div
        className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-center`}
        style={{ gap: `${gap}px` }}
        animate={{ x: isMobile ? 0 : tx, y: isMobile ? ty : 0 }}
        transition={SPRING}
      >
        {PROJECTS.map((project, i) => (
          // individual boxes
          <motion.div
            key={project.title}
            className={`relative flex-shrink-0 flex items-center justify-center ${
              (isMobile && Math.abs(i - activeIndex) === 1) || (i === activeIndex && project.onClick) 
                ? 'pointer-events-auto cursor-pointer' 
                : 'pointer-events-none'
            }`}
            animate={{
              width: isMobile ? getMobileWidth(vp) : getWidth(i, activeIndex, vp.w),
              height: isMobile ? getMobileHeight(i, activeIndex, vp, gap) : getHeight(i, activeIndex, vp.h),
              backgroundColor: getColor(i, activeIndex),
            }}
            transition={SPRING}
            onClick={() => {
              if (isMobile) {
                if (i === activeIndex - 1 || i === activeIndex + 1) setActiveIndex(i);
                else if (i === activeIndex && project.onClick) project.onClick();
              } else {
                if (i === activeIndex && project.onClick) project.onClick();
              }
            }}
          >
            {isMobile && i === activeIndex - 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <ChevronUp />
              </motion.div>
            )}
            {isMobile && i === activeIndex + 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <ChevronDown />
              </motion.div>
            )}

            {/* title */}
            {!isMobile && i === activeIndex && (
              <motion.div
                className="absolute -top-6 left-0 text-sm text-gray-500 whitespace-nowrap"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING}
              >
                {project.title}
              </motion.div>
            )}

            {/* image */}
            {i === activeIndex && project.imgUrl && (
              <motion.img
                src={project.imgUrl}
                alt={project.title}
                className="absolute inset-0 m-auto object-contain pointer-events-none"
                style={{ width: `${(project.imgScale ?? 0.5) * 100}%`, height: `${(project.imgScale ?? 0.5) * 100}%` }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING}
              />
            )}

            {/* links for contacts */}
            {i === activeIndex && project.links && (
              project.links.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`absolute ${LINK_POSITIONS[link.position]} font-normal text-white ${isMobile ? 'text-[20px]' : 'text-[48px]'} font-light pointer-events-auto hover:opacity-70 transition-opacity`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={SPRING}
                >
                  {link.label}
                </motion.a>
              ))
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
