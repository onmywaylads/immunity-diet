import { useState, useEffect } from "react";

const STORAGE_KEY   = "immunity-diet-history";
const PREFS_KEY     = "immunity-diet-prefs";
const FAVORITES_KEY = "immunity-diet-favorites";

const today = () => new Date().toISOString().split("T")[0];
const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
};

const MEAL_ORDER = ["아침", "점심", "오후간식", "저녁"];
const MEAL_META = {
  아침:     { icon: "🌅", bg: "#fff8f0", accent: "#d4772a", label: "아침 식사",  time: "07:00 – 08:30" },
  점심:     { icon: "☀️", bg: "#f0faf3", accent: "#2e7d4f", label: "점심 식사",  time: "12:00 – 13:30" },
  오후간식: { icon: "🍵", bg: "#fdf5ff", accent: "#8b5db5", label: "오후 간식",  time: "15:00 – 16:00" },
  저녁:     { icon: "🌙", bg: "#f0f4ff", accent: "#3a5bbf", label: "저녁 식사",  time: "18:00 – 19:30" },
};

const INGREDIENT_OPTIONS = {
  "단백질류": [
    { id: "fish",    emoji: "🐟", label: "생선" },
    { id: "chicken", emoji: "🍗", label: "닭가슴살" },
    { id: "egg",     emoji: "🥚", label: "달걀" },
    { id: "tofu",    emoji: "🫘", label: "두부" },
    { id: "beef",    emoji: "🥩", label: "소고기" },
    { id: "pork",    emoji: "🐷", label: "돼지고기" },
  ],
  "채소류": [
    { id: "broccoli", emoji: "🥦", label: "브로콜리" },
    { id: "carrot",   emoji: "🥕", label: "당근" },
    { id: "mushroom", emoji: "🍄", label: "버섯" },
    { id: "spinach",  emoji: "🥬", label: "시금치" },
    { id: "potato",   emoji: "🥔", label: "감자" },
    { id: "zucchini", emoji: "🫑", label: "애호박" },
    { id: "onion",    emoji: "🧅", label: "양파" },
    { id: "tomato",   emoji: "🍅", label: "토마토" },
  ],
  "해산물": [
    { id: "shrimp",   emoji: "🦐", label: "새우" },
    { id: "clam",     emoji: "🐚", label: "조개" },
    { id: "mackerel", emoji: "🐠", label: "고등어" },
    { id: "squid",    emoji: "🦑", label: "오징어" },
  ],
  "곡류/기타": [
    { id: "rice",      emoji: "🍚", label: "흰쌀" },
    { id: "brownrice", emoji: "🌾", label: "현미" },
    { id: "seaweed",   emoji: "🌿", label: "미역/다시마" },
    { id: "corn",      emoji: "🌽", label: "옥수수" },
  ],
};

const EXCLUDE_OPTIONS = [
  { id: "spicy",   emoji: "🌶️", label: "매운 음식" },
  { id: "raw",     emoji: "🍣",  label: "날것 (회 등)" },
  { id: "dairy",   emoji: "🥛",  label: "유제품" },
  { id: "gluten",  emoji: "🍞",  label: "밀가루/글루텐" },
  { id: "nuts",    emoji: "🥜",  label: "견과류" },
  { id: "greasy",  emoji: "🍳",  label: "기름진 음식" },
  { id: "salty",   emoji: "🧂",  label: "짠 음식" },
  { id: "cold",    emoji: "🧊",  label: "차가운 음식" },
];

const ALL_INGREDIENTS = Object.values(INGREDIENT_OPTIONS).flat();
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ── 핵심: 폐암 환자 특화 + 실제 황금레시피 검색 시스템 프롬프트
function buildSystemPrompt(liked, excluded, favorites) {
  const likedStr    = liked.length     > 0 ? `선호 재료: ${liked.join(", ")}`                 : "선호 재료: 제한 없음";
  const excludeStr  = excluded.length  > 0 ? `절대 제외: ${excluded.join(", ")}`               : "제외 항목: 없음";
  const favStr      = favorites.length > 0 ? `즐겨찾기 메뉴 (자주 포함 권장): ${favorites.join(", ")}` : "";

  return `당신은 폐암 환자 전문 영양사이자 한국 가정식 요리 전문가입니다.

【최우선 원칙 - 반드시 준수】
1. 반드시 실제로 존재하는 한국 가정식 메뉴만 선정할 것 (창작 메뉴 절대 금지)
2. 폐암 환자에게 의학적으로 도움이 되는 메뉴만 선정할 것
3. 각 메뉴는 반드시 웹 검색으로 "메뉴명 황금레시피"를 검색해 실제 레시피를 확인할 것

【폐암 환자 식단 의학적 기준】
✅ 적극 포함:
- 항산화 성분 (브로콜리, 토마토, 블루베리, 당근) → 암세포 성장 억제
- 오메가-3 (고등어, 연어, 삼치) → 항염증, 면역력 강화
- 단백질 (두부, 달걀, 닭가슴살, 생선) → 근육 유지, 항암 치료 회복
- 식이섬유 (현미, 버섯, 나물류) → 장 건강, 독소 배출
- 비타민C/E (시금치, 감자, 견과류) → 면역 강화
- 발효식품 (된장, 김치 소량) → 장내 미생물 균형

❌ 반드시 피할 것:
- 훈제/가공육 (소시지, 햄, 베이컨)
- 탄 음식, 튀긴 음식
- 과도한 소금/나트륨
- 생고기, 날음식 (감염 위험)

【조리 방법 원칙】
- 찌기, 삶기, 조리기, 국/찌개 위주 (튀김 금지)
- 소화가 잘 되는 부드러운 조리
- 간은 최소화 (싱겁게)

${likedStr}
${excludeStr}
${favStr}

【임무】
1. 폐암 환자에게 최적화된 실존 한국 가정식 메뉴 4가지 선정 (아침/점심/오후간식/저녁)
2. 각 메뉴마다 웹 검색: "[메뉴명] 황금레시피" 검색 → 실제 재료와 조리법 확인
3. 검색된 실제 레시피 기반으로 정확한 재료 양(큰술, g 단위)과 단계별 조리법 작성
4. 왜 폐암 환자에게 이 메뉴가 좋은지 의학적 근거 명시

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트 없이:
{
  "theme": "오늘의 식단 테마 한 줄",
  "tip": "폐암 환자를 위한 오늘의 영양 팁 (구체적으로)",
  "meals": {
    "아침":     { "name": "실존 메뉴명", "description": "한 줄 설명", "ingredients": ["재료 (정확한 양)"], "recipe": ["1. 조리 단계"], "nutrition": "칼로리 및 주요 영양소", "benefit": "폐암 환자에게 좋은 의학적 이유", "source": "레시피 참고 출처" },
    "점심":     { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "", "source": "" },
    "오후간식": { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "", "source": "" },
    "저녁":     { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "", "source": "" }
  }
}`;
}

async function generateDiet(dateStr, liked, excluded, favorites, previousMeals) {
  const prevList = previousMeals.length > 0
    ? `\n\n이미 사용한 메뉴 (중복 금지, 단 즐겨찾기 메뉴는 가끔 반복 가능): ${previousMeals.join(", ")}`
    : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: buildSystemPrompt(liked, excluded, favorites),
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `${dateStr} 날짜의 폐암 환자를 위한 맞춤 식단을 만들어주세요.
각 메뉴마다 반드시 웹 검색으로 실제 황금레시피를 확인하고, 정확한 재료와 조리법을 작성해주세요.${prevList}

최종 응답은 반드시 JSON 형식만 반환하세요.`
      }],
    }),
  });

  const data = await res.json();
  const textBlocks = data.content?.filter((b) => b.type === "text") || [];
  const lastText = textBlocks[textBlocks.length - 1]?.text || "{}";
  const jsonMatch = lastText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("JSON 파싱 실패");
  return JSON.parse(jsonMatch[0]);
}

/* ── 재료 선택 화면 ─────────────────────────────── */
function PreferenceScreen({ initialPrefs, onConfirm }) {
  const [liked,    setLiked]    = useState(initialPrefs?.likedIds    || []);
  const [excluded, setExcluded] = useState(initialPrefs?.excludedIds || []);
  const [step, setStep] = useState(1);

  const toggle = (arr, setArr, id) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const likedLabels    = ALL_INGREDIENTS.filter((o) => liked.includes(o.id)).map((o) => o.label);
  const excludedLabels = EXCLUDE_OPTIONS.filter((o)  => excluded.includes(o.id)).map((o) => o.label);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'Georgia', serif" }}>
      <div style={{ background: "linear-gradient(150deg,#1a3d28,#2e7d4f 55%,#4a9e6f)", padding: "32px 24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", fontFamily: "sans-serif" }}>오늘의 식단 준비</div>
          <h1 style={{ fontSize: 24, fontWeight: "normal", color: "#fff", margin: "0 0 6px" }}>🌿 식재료 선택</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0, fontFamily: "sans-serif" }}>
            선택하신 재료로 실제 황금레시피를 검색해 식단을 구성해 드려요
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 40px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[{ n: 1, label: "✓ 좋아하는 재료" }, { n: 2, label: "✕ 제외할 음식" }].map(({ n, label }) => (
            <button key={n} onClick={() => setStep(n)} style={{ flex: 1, padding: "12px 0", borderRadius: 14, cursor: "pointer", background: step === n ? "#2e7d4f" : "#fff", border: `1.5px solid ${step === n ? "#2e7d4f" : "#e4ddd4"}`, color: step === n ? "#fff" : "#888", fontSize: 13, fontFamily: "sans-serif", fontWeight: step === n ? "bold" : "normal", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: "#888", fontFamily: "sans-serif", margin: "0 0 20px", lineHeight: 1.8 }}>
              부모님이 좋아하시는 재료를 선택해 주세요.<br />
              <span style={{ fontSize: 12, color: "#bbb" }}>폐암 회복에 도움되는 메뉴 중 선호 재료 중심으로 구성해요</span>
            </p>
            {Object.entries(INGREDIENT_OPTIONS).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: 11, color: "#aaa", letterSpacing: 2, fontFamily: "sans-serif", textTransform: "uppercase", margin: "0 0 10px" }}>{cat}</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {items.map((item) => {
                    const on = liked.includes(item.id);
                    return (
                      <button key={item.id} onClick={() => toggle(liked, setLiked, item.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, cursor: "pointer", background: on ? "#2e7d4f" : "#fff", color: on ? "#fff" : "#3a2e1e", border: `1.5px solid ${on ? "#2e7d4f" : "#e4ddd4"}`, fontSize: 13, fontFamily: "sans-serif", transition: "all 0.15s" }}>
                        {item.emoji} {item.label} {on && "✓"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={() => setStep(2)} style={{ width: "100%", background: "#2e7d4f", color: "#fff", border: "none", borderRadius: 16, padding: "15px", fontSize: 15, cursor: "pointer", fontFamily: "sans-serif", marginTop: 8 }}>
              다음 → 제외할 음식 선택
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: "#888", fontFamily: "sans-serif", margin: "0 0 20px", lineHeight: 1.8 }}>
              드시기 어렵거나 피해야 할 음식을 선택해 주세요.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {EXCLUDE_OPTIONS.map((item) => {
                const on = excluded.includes(item.id);
                return (
                  <button key={item.id} onClick={() => toggle(excluded, setExcluded, item.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, cursor: "pointer", background: on ? "#c0392b" : "#fff", color: on ? "#fff" : "#3a2e1e", border: `1.5px solid ${on ? "#c0392b" : "#e4ddd4"}`, fontSize: 13, fontFamily: "sans-serif", transition: "all 0.15s" }}>
                    {item.emoji} {item.label} {on && "✕"}
                  </button>
                );
              })}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #e4ddd4", marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "#bbb", fontFamily: "sans-serif", margin: "0 0 10px", letterSpacing: 1, textTransform: "uppercase" }}>오늘 식단 요약</p>
              <div style={{ fontSize: 13, fontFamily: "sans-serif", lineHeight: 2.2, color: "#3a2e1e" }}>
                <span style={{ color: "#2e7d4f", fontWeight: "bold" }}>✓ 선호</span>{"  "}
                {likedLabels.length > 0 ? likedLabels.join(", ") : "제한 없음"}<br />
                <span style={{ color: "#c0392b", fontWeight: "bold" }}>✕ 제외</span>{"  "}
                {excludedLabels.length > 0 ? excludedLabels.join(", ") : "없음"}
              </div>
            </div>

            <div style={{ background: "#f0f7ff", borderRadius: 12, padding: "12px 16px", marginBottom: 20, border: "1px solid #c8dff8" }}>
              <p style={{ fontSize: 12, color: "#3a6bbf", fontFamily: "sans-serif", margin: 0, lineHeight: 1.8 }}>
                🔍 <strong>황금레시피 검색 포함</strong> — 각 메뉴마다 실제 레시피를 검색하므로 약 30초~1분 소요
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: "#fff", color: "#888", border: "1.5px solid #e4ddd4", borderRadius: 16, padding: "14px", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}>← 뒤로</button>
              <button onClick={() => onConfirm(liked, excluded, likedLabels, excludedLabels)} style={{ flex: 2, background: "#c8673a", color: "#fff", border: "none", borderRadius: 16, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "sans-serif", fontWeight: "bold" }}>
                🔍 황금레시피로 식단 생성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 로딩 화면 ─────────────────────────────────── */
function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = [
    "🩺 폐암 회복에 좋은 메뉴를 고르고 있어요...",
    "🔍 황금레시피를 검색하고 있어요...",
    "📝 실제 재료와 조리법을 정리하고 있어요...",
    "🌿 의학적 효능을 확인하고 있어요...",
    "✨ 거의 다 됐어요!",
  ];
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => Math.min(i + 1, messages.length - 1)), 12000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "70px 24px", textAlign: "center", border: "1px solid #e4ddd4" }}>
      <div style={{ fontSize: 44, marginBottom: 20, display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }}>🌿</div>
      <p style={{ color: "#2e7d4f", fontSize: 16, margin: "0 0 10px" }}>{messages[msgIdx]}</p>
      <p style={{ color: "#bbb", fontSize: 12, margin: "0 0 24px", fontFamily: "sans-serif" }}>실제 레시피를 검색 중이라 30초~1분 정도 걸려요</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {messages.map((_, i) => (
          <div key={i} style={{ width: i === msgIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === msgIdx ? "#2e7d4f" : "#e0e0e0", transition: "all 0.3s" }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
    </div>
  );
}

/* ── 즐겨찾기 탭 ─────────────────────────────── */
function FavoritesTab({ favorites, onClose }) {
  if (favorites.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "32px 24px", border: "1px solid #e4ddd4", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🤍</div>
      <p style={{ color: "#aaa", fontSize: 14, fontFamily: "sans-serif" }}>
        아직 즐겨찾기한 메뉴가 없어요<br />
        <span style={{ fontSize: 12 }}>맛있는 메뉴의 🤍 버튼을 눌러보세요</span>
      </p>
    </div>
  );
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #e4ddd4", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: "#2e7d4f", fontFamily: "sans-serif", margin: 0, fontWeight: "bold" }}>
          ❤️ 즐겨찾기 메뉴 ({favorites.length}개)
        </p>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <p style={{ fontSize: 12, color: "#aaa", fontFamily: "sans-serif", margin: "0 0 12px" }}>
        식단 생성 시 이 메뉴들이 가끔 다시 추천돼요
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {favorites.map((name, i) => (
          <div key={i} style={{ background: "#fff0f0", border: "1px solid #f5c0c0", borderRadius: 20, padding: "6px 14px", fontSize: 13, color: "#c0392b", fontFamily: "sans-serif" }}>
            ❤️ {name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 메인 앱 ─────────────────────────────────────── */
export default function App() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  });
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "null"); } catch { return null; }
  });
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; }
  });

  const [selectedDate,   setSelectedDate]   = useState(today());
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [expandedMeal,   setExpandedMeal]   = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [showFavorites,  setShowFavorites]  = useState(false);
  const [showPrefScreen, setShowPrefScreen] = useState(false);

  useEffect(() => {
    if (!history[today()]) setShowPrefScreen(true);
  }, []);

  const saveHistory  = (h) => { setHistory(h);  localStorage.setItem(STORAGE_KEY,   JSON.stringify(h)); };
  const saveFavorites = (f) => { setFavorites(f); localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)); };

  const toggleFavorite = (mealName) => {
    const updated = favorites.includes(mealName)
      ? favorites.filter((n) => n !== mealName)
      : [...favorites, mealName];
    saveFavorites(updated);
  };

  const handleConfirm = async (likedIds, excludedIds, likedLabels, excludedLabels) => {
    const newPrefs = { likedIds, excludedIds, likedLabels, excludedLabels };
    setPrefs(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    setShowPrefScreen(false);
    await runGenerate(today(), likedLabels, excludedLabels);
  };

  const runGenerate = async (dateStr, liked, excluded) => {
    const l = liked    ?? prefs?.likedLabels    ?? [];
    const e = excluded ?? prefs?.excludedLabels ?? [];
    setLoading(true); setError(null); setExpandedMeal(null);
    try {
      const prev = Object.values(history).flatMap((d) =>
        d?.meals ? Object.values(d.meals).map((m) => m.name) : []
      );
      const data = await generateDiet(dateStr, l, e, favorites, prev);
      saveHistory({ ...history, [dateStr]: data });
      setSelectedDate(dateStr);
    } catch (err) {
      setError("식단 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (showPrefScreen) return <PreferenceScreen initialPrefs={prefs} onConfirm={handleConfirm} />;

  const currentDiet = history[selectedDate];
  const sortedDates = Object.keys(history).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'Georgia', serif", color: "#1e1a12" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(150deg,#1a3d28,#2e7d4f 55%,#4a9e6f)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "36px 24px 28px", position: "relative" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)", marginBottom: 12, textTransform: "uppercase", fontFamily: "sans-serif" }}>회복을 응원하는 맞춤 식단</div>
          <h1 style={{ fontSize: 26, fontWeight: "normal", color: "#fff", margin: "0 0 6px" }}>🌿 면역력 강화 맞춤 식단</h1>
          {prefs?.likedLabels?.length > 0 && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", fontFamily: "sans-serif" }}>
              선호: {prefs.likedLabels.join(" · ")}
              {prefs?.excludedLabels?.length > 0 && `  |  제외: ${prefs.excludedLabels.join(" · ")}`}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 30, padding: "6px 16px" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "sans-serif" }}>📅 {formatDate(selectedDate)}</span>
            </div>
            <button onClick={() => setShowPrefScreen(true)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 30, padding: "6px 14px", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" }}>
              ⚙️ 재료 변경
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* Action bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }} style={{ background: showHistory ? "#2e7d4f" : "#fff", color: showHistory ? "#fff" : "#2e7d4f", border: "1.5px solid #2e7d4f", borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
            📋 기록 {sortedDates.length > 0 ? `(${sortedDates.length})` : ""}
          </button>
          <button onClick={() => { setShowFavorites(!showFavorites); setShowHistory(false); }} style={{ background: showFavorites ? "#c0392b" : "#fff", color: showFavorites ? "#fff" : "#c0392b", border: "1.5px solid #c0392b", borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
            ❤️ 즐겨찾기 {favorites.length > 0 ? `(${favorites.length})` : ""}
          </button>
          <button onClick={() => setShowPrefScreen(true)} disabled={loading} style={{ background: loading ? "#ccc" : "#c8673a", color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: loading ? "default" : "pointer", fontFamily: "sans-serif", marginLeft: "auto" }}>
            {loading ? "⏳ 검색 중..." : "🔄 오늘 새로 생성"}
          </button>
        </div>

        {/* 즐겨찾기 패널 */}
        {showFavorites && <FavoritesTab favorites={favorites} onClose={() => setShowFavorites(false)} />}

        {/* 날짜 기록 패널 */}
        {showHistory && sortedDates.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #e4ddd4" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "#bbb", fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>저장된 날짜</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sortedDates.map((d) => (
                <button key={d} onClick={() => { setSelectedDate(d); setShowHistory(false); setExpandedMeal(null); }}
                  style={{ background: d === selectedDate ? "#2e7d4f" : "#f0ede7", color: d === selectedDate ? "#fff" : "#3a2e1e", border: "none", borderRadius: 12, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" }}>
                  {d === today() ? `오늘 (${d})` : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ background: "#fff0ed", border: "1px solid #e8a090", borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 14, color: "#c0392b", fontFamily: "sans-serif" }}>⚠️ {error}</div>}

        {loading && <LoadingScreen />}

        {!loading && currentDiet && (
          <div>
            {/* 테마 & 팁 */}
            <div style={{ background: "linear-gradient(135deg,#f5f0e8,#fff)", borderRadius: 20, padding: "22px 24px", marginBottom: 14, border: "1px solid #e4ddd4", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 17, fontStyle: "italic", marginBottom: 14, lineHeight: 1.5 }}>"{currentDiet.theme}"</div>
              <div style={{ background: "#edf7f2", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#1e5c36", lineHeight: 1.8, fontFamily: "sans-serif" }}>
                💡 <strong>오늘의 건강 팁</strong><br />{currentDiet.tip}
              </div>
            </div>

            {/* 끼니 카드 */}
            {MEAL_ORDER.map((mealName) => {
              const meal = currentDiet.meals?.[mealName];
              if (!meal) return null;
              const meta = MEAL_META[mealName];
              const isExpanded  = expandedMeal === mealName;
              const isFavorited = favorites.includes(meal.name);

              return (
                <div key={mealName} style={{ background: "#fff", borderRadius: 20, marginBottom: 12, border: "1px solid #e8e0d6", boxShadow: isExpanded ? "0 6px 24px rgba(0,0,0,0.08)" : "0 2px 10px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                  {/* 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", padding: "18px 20px", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1.5px solid ${meta.accent}22` }}>{meta.icon}</div>
                    <button onClick={() => setExpandedMeal(isExpanded ? null : mealName)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: meta.accent, fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 0.5 }}>{meta.label}</span>
                        <span style={{ fontSize: 10, color: "#ccc", fontFamily: "sans-serif" }}>{meta.time}</span>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: "bold", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1e1a12" }}>{meal.name}</div>
                      <div style={{ fontSize: 12, color: "#999", fontFamily: "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meal.description}</div>
                    </button>
                    {/* 즐겨찾기 버튼 */}
                    <button
                      onClick={() => toggleFavorite(meal.name)}
                      title={isFavorited ? "즐겨찾기 해제" : "맛있어요! 다음에 또 추천받기"}
                      style={{ flexShrink: 0, background: isFavorited ? "#fff0f0" : "#f8f8f8", border: `1.5px solid ${isFavorited ? "#f5c0c0" : "#eee"}`, borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                    >
                      {isFavorited ? "❤️" : "🤍"}
                    </button>
                    {/* 펼치기 */}
                    <button onClick={() => setExpandedMeal(isExpanded ? null : mealName)} style={{ background: "none", border: "none", fontSize: 16, color: meta.accent, cursor: "pointer", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</button>
                  </div>

                  {/* 펼쳐진 상세 */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${meta.accent}18`, padding: "0 20px 22px" }}>
                      {/* 폐암 효능 */}
                      <div style={{ background: meta.bg, borderRadius: 12, padding: "12px 16px", margin: "16px 0", fontSize: 13, color: meta.accent, lineHeight: 1.7, fontFamily: "sans-serif", border: `1px solid ${meta.accent}22` }}>
                        🫁 <strong>회복에 좋은 이유:</strong> {meal.benefit}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#c8673a", letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>재료</h4>
                          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                            {meal.ingredients?.map((ing, i) => <li key={i} style={{ fontSize: 12, color: "#3a2e1e", padding: "4px 0", fontFamily: "sans-serif", borderBottom: "1px dotted #f0e8e0" }}>· {ing}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#2e7d4f", letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>영양 정보</h4>
                          <p style={{ fontSize: 12, color: "#666", fontFamily: "sans-serif", lineHeight: 1.7, margin: 0 }}>{meal.nutrition}</p>
                        </div>
                      </div>

                      <h4 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>조리 방법</h4>
                      <ol style={{ margin: 0, padding: "0 0 0 18px" }}>
                        {meal.recipe?.map((step, i) => <li key={i} style={{ fontSize: 13, color: "#3a2e1e", padding: "5px 0", fontFamily: "sans-serif", lineHeight: 1.7 }}>{step.replace(/^\d+\.\s*/, "")}</li>)}
                      </ol>

                      {meal.source && (
                        <div style={{ marginTop: 14, padding: "8px 12px", background: "#f8f8f8", borderRadius: 8, fontSize: 11, color: "#aaa", fontFamily: "sans-serif" }}>
                          📌 레시피 참고: {meal.source}
                        </div>
                      )}

                      {/* 즐겨찾기 안내 */}
                      {!isFavorited && (
                        <button onClick={() => toggleFavorite(meal.name)} style={{ marginTop: 14, width: "100%", background: "#fff0f0", border: "1.5px dashed #f5c0c0", borderRadius: 12, padding: "10px", fontSize: 13, color: "#c0392b", cursor: "pointer", fontFamily: "sans-serif" }}>
                          🤍 맛있었다면? 다음에 또 추천받기
                        </button>
                      )}
                      {isFavorited && (
                        <div style={{ marginTop: 14, background: "#fff0f0", borderRadius: 12, padding: "10px", fontSize: 13, color: "#c0392b", fontFamily: "sans-serif", textAlign: "center", border: "1.5px solid #f5c0c0" }}>
                          ❤️ 즐겨찾기 등록됨 — 다음 식단 생성 시 가끔 다시 추천돼요
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ textAlign: "center", padding: "24px 16px 0", fontSize: 12, color: "#ccc", fontFamily: "sans-serif", lineHeight: 1.8 }}>
              ⚕️ 이 식단은 참고용입니다 · 담당 의사 및 영양사의 지도를 함께 따르세요
            </div>
          </div>
        )}

        {!loading && !currentDiet && !error && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "70px 24px", textAlign: "center", border: "1px solid #e4ddd4" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
            <p style={{ color: "#aaa", fontSize: 15, fontFamily: "sans-serif" }}>오늘의 식단을 불러오는 중입니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}
