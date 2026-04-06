import { useState } from "react";

/* ──────────────────────────────────────────────
   Types
────────────────────────────────────────────── */
type PropertyStatus = "active" | "mortgaged";
type ActionTooltip = { sell_house: string; sell_deed: string; mortgage: string };

interface Property {
  id: string;
  name: string;
  area: string;
  areaColor: string;
  marketValue: string;
  structure: string;
  structureColor: string;
  description: string;
  image: string;
  status: PropertyStatus;
  redeemCost?: string;
  tooltip?: ActionTooltip;
}

interface Props {
  totalDebt?: string;
  totalAssets?: string;
  timeRemaining?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onCannotPay?: () => void;
}

/* ──────────────────────────────────────────────
   Static Data
────────────────────────────────────────────── */
const PROPERTIES: Property[] = [
  {
    id: "BD-001",
    name: "Biệt thự Ba Đình",
    area: "Ba Đình",
    areaColor: "#3b82f6",
    marketValue: "$500,000",
    structure: "3 Nhà",
    structureColor: "#f6be39",
    description: "Cơ cấu thanh lý ưu tiên theo thứ tự: Hạ tầng → Quyền sử dụng đất.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD8vg7NbzBC0x6GkGbp6UKnVEjtgUSUgIMPHSyQuqgnMkE-jELPkd5wVWmQu6q-ZGd0GXCopuCi-zwwBTiGmkFDzh6E7jKz4IDNHLG6bFgtEMWgFOlwlfSlT9jnQUM5l0hyS3c4-re0mWt3c38n3SI8R9_n6F-x60tKUFWrqjMqZHlCp4c4A8VFx3jLpLJr_8m_qhL82EWg2J7tMSq3GHVdrEdgI4BGIZ2ts8MhkT1_KmSibg7FuMx-MNUXdXxWRAv1FWWxOhA44o4",
    status: "active",
    tooltip: {
      sell_house: "Thu hồi vốn xây dựng nhanh chóng. Giữ lại quyền sở hữu đất.",
      sell_deed: "Bán toàn bộ đất và hạ tầng. Bạn sẽ mất vĩnh viễn tài sản này.",
      mortgage: "Vay vốn tạm thời (50% giá trị). Có thể chuộc lại sau.",
    },
  },
  {
    id: "BD-002",
    name: "Căn hộ Cửa Bắc",
    area: "Ba Đình",
    areaColor: "#3b82f6",
    marketValue: "$330,000",
    structure: "Đã cầm cố",
    structureColor: "#bdcabe",
    description: "Tài sản này đang được thế chấp cho ngân hàng.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD8vg7NbzBC0x6GkGbp6UKnVEjtgUSUgIMPHSyQuqgnMkE-jELPkd5wVWmQu6q-ZGd0GXCopuCi-zwwBTiGmkFDzh6E7jKz4IDNHLG6bFgtEMWgFOlwlfSlT9jnQUM5l0hyS3c4-re0mWt3c38n3SI8R9_n6F-x60tKUFWrqjMqZHlCp4c4A8VFx3jLpLJr_8m_qhL82EWg2J7tMSq3GHVdrEdgI4BGIZ2ts8MhkT1_KmSibg7FuMx-MNUXdXxWRAv1FWWxOhA44o4",
    status: "mortgaged",
    redeemCost: "$165,000",
  },
  {
    id: "Q1-001",
    name: "Khách sạn Đồng Khởi",
    area: "Quận 1",
    areaColor: "#ec4899",
    marketValue: "$1,200,000",
    structure: "1 Khách sạn",
    structureColor: "#f6be39",
    description:
      "Thanh lý khách sạn để giải tỏa áp lực nợ xấu nhưng vẫn giữ vị trí đắc địa trên bản đồ.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCA4Ml2T4BaCIs4Zf_aFMtKnUoT-vDG_7JDjXTa79Q_gi8xEAG0Thl37ReR2BeYnNF_vxX0L1Vlo0-ISwvcCRSTTwDRR9jyQHI1scCZCzMUt_9FcNHVhCM-tDUAY0fyKv9rDFHmvFWYUKLTtLVj3FcTNPNOV24A_pbCHnpPLLI-6l2EJUzDO7RO8acfveVpywk_XEk6IDXA_8JUFtz8OAmtmsCV5DBFRLae6OZPqMcnQoeLF-IlmNtk8jRYgVGLGggm657TVWUSDOU",
    status: "active",
    tooltip: {
      sell_house: "Thanh lý cấu trúc khách sạn. Đất vẫn thuộc về bạn.",
      sell_deed: "Chuyển nhượng toàn bộ quyền sở hữu khu đất kim cương này.",
      mortgage: "Thế chấp sổ đỏ lấy tiền mặt gấp. Lãi suất ngân hàng áp dụng.",
    },
  },
];

/* ──────────────────────────────────────────────
   Global styles
────────────────────────────────────────────── */
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Barlow+Condensed:wght@400;600;700&family=Work+Sans:wght@400;500&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

  .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    vertical-align: middle;
    line-height: 1;
    display: inline-block;
  }
  .icon-filled { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .gold-glow   { text-shadow: 0 0 8px rgba(246,190,57,0.4); }
  .debt-glow   { text-shadow: 0 0 15px rgba(105,0,5,0.4); }
  .modal-shadow { box-shadow: 0 0 60px rgba(0,0,0,1); }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0e0e0e; }
  ::-webkit-scrollbar-thumb { background: #d4a017; }
`;

/* ──────────────────────────────────────────────
   Tooltip button
────────────────────────────────────────────── */
interface ActionBtnProps {
  label: string;
  tooltip: string;
  variant: "gold" | "danger" | "outline";
  tooltipAlign?: "left" | "right";
  onClick?: () => void;
}

function ActionBtn({ label, tooltip, variant, tooltipAlign = "left", onClick }: ActionBtnProps) {
  const base =
    "relative group/btn w-full font-['Barlow_Condensed'] text-[10px] font-bold py-2.5 uppercase tracking-widest transition-all cursor-pointer border-0";

  const styles: Record<ActionBtnProps["variant"], string> = {
    gold: "bg-[#2a2a2a] border border-[#d4a017]/30 text-[#f6be39] hover:bg-[#f6be39]/10",
    danger: "bg-[#353534] text-[#e5e2e1] hover:bg-[#ffb4ab]/20 hover:text-[#ffb4ab]",
    outline: "border border-[#d4a017]/50 bg-transparent text-[#bdcabe] hover:bg-[#2a2a2a]",
  };

  const tooltipBorder: Record<ActionBtnProps["variant"], string> = {
    gold: "border-[#d4a017]",
    danger: "border-[#ffb4ab]",
    outline: "border-[#d4a017]",
  };

  const tooltipText: Record<ActionBtnProps["variant"], string> = {
    gold: "text-[#bdcabe]",
    danger: "text-[#ffb4ab]",
    outline: "text-[#bdcabe]",
  };

  return (
    <div className="relative group/btn">
      <button className={`${base} ${styles[variant]}`} onClick={onClick}>
        {label}
      </button>
      <div
        className={`absolute bottom-full mb-2 w-48 bg-[#0e0e0e] border p-2 text-[10px]
          opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity z-20
          ${tooltipAlign === "right" ? "right-0" : "left-0"}
          ${tooltipBorder[variant]} ${tooltipText[variant]}`}
      >
        {tooltip}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Active property card
────────────────────────────────────────────── */
function ActiveCard({ property }: { property: Property }) {
  return (
    <div className="flex flex-col sm:flex-row bg-[#201f1f] border border-[#4f4634]/20
      hover:border-[#d4a017]/50 transition-colors relative group">
      {/* Color strip */}
      <div className="w-full sm:w-1.5 h-1.5 sm:h-auto shrink-0"
        style={{ backgroundColor: property.areaColor }} />

      {/* Image */}
      <div className="w-full sm:w-32 h-48 sm:h-auto relative overflow-hidden shrink-0">
        <img
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          src={property.image}
          alt={property.name}
        />
      </div>

      {/* Info */}
      <div className="grow p-4 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h5 className="font-['Noto_Serif'] text-lg text-[#e5e2e1] font-bold">{property.name}</h5>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <p className="font-['Barlow_Condensed'] text-xs text-[#bdcabe] uppercase tracking-wider">
                Thị giá: <span className="text-[#e5e2e1] font-bold">{property.marketValue}</span>
              </p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#bdcabe] uppercase tracking-wider">
                Xây dựng:{" "}
                <span style={{ color: property.structureColor }} className="font-bold">
                  {property.structure}
                </span>
              </p>
            </div>
          </div>
          <div className="bg-[#353534] px-3 py-1 border border-[#4f4634] shrink-0">
            <span className="font-['Barlow_Condensed'] text-[10px] text-[#bdcabe] uppercase tracking-widest font-bold">
              ID: {property.id}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#bdcabe] font-['Work_Sans'] italic mb-4 leading-snug">
          {property.description}
        </p>

        <div className="grid grid-cols-3 gap-2 mt-auto">
          <ActionBtn
            label="BÁN NHÀ"
            tooltip={property.tooltip!.sell_house}
            variant="gold"
            tooltipAlign="left"
          />
          <ActionBtn
            label="BÁN SỔ ĐỎ"
            tooltip={property.tooltip!.sell_deed}
            variant="danger"
            tooltipAlign="left"
          />
          <ActionBtn
            label="CẦM CỐ"
            tooltip={property.tooltip!.mortgage}
            variant="outline"
            tooltipAlign="right"
          />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Mortgaged property card
────────────────────────────────────────────── */
function MortgagedCard({ property }: { property: Property }) {
  return (
    <div className="flex flex-col sm:flex-row bg-[#201f1f]/50 border border-[#4f4634]/10 opacity-60 relative">
      <div className="w-full sm:w-1.5 h-1.5 sm:h-auto shrink-0"
        style={{ backgroundColor: property.areaColor }} />

      <div className="w-full sm:w-32 h-32 sm:h-auto relative overflow-hidden shrink-0">
        <img className="w-full h-full object-cover grayscale" src={property.image} alt={property.name} />
        <div className="absolute inset-0 bg-[#0e0e0e]/60 flex items-center justify-center">
          <span className="font-['Barlow_Condensed'] font-bold text-[#f6be39] tracking-widest border-2 border-[#f6be39] px-3 py-1 rotate-12 text-sm">
            ĐÃ CẦM CỐ
          </span>
        </div>
      </div>

      <div className="grow p-4 flex flex-col justify-between">
        <div>
          <h5 className="font-['Noto_Serif'] text-lg text-[#bdcabe] font-bold">{property.name}</h5>
          <p className="font-['Barlow_Condensed'] text-xs text-[#bdcabe]/60 uppercase tracking-wider mt-1">
            {property.description}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <button className="w-full bg-[#2a2a2a] border-2 border-[#f6be39] text-[#f6be39]
            font-['Barlow_Condensed'] text-sm font-bold py-3 uppercase tracking-widest
            hover:bg-[#f6be39] hover:text-[#261a00] transition-all
            shadow-[0_0_15px_rgba(212,160,23,0.2)] cursor-pointer">
            CHUỘC LẠI ({property.redeemCost})
          </button>
          <p className="text-[10px] text-[#bdcabe] italic text-center opacity-80">
            * Tài sản sau khi chuộc lại sẽ bắt đầu thu thuế bình thường.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Group properties by area
────────────────────────────────────────────── */
function groupByArea(properties: Property[]) {
  return properties.reduce<Record<string, Property[]>>((acc, p) => {
    if (!acc[p.area]) acc[p.area] = [];
    acc[p.area].push(p);
    return acc;
  }, {});
}

/* ──────────────────────────────────────────────
   Main Component
────────────────────────────────────────────── */
export default function LiquidationPanel({
  totalDebt = "-$2,500,000",
  totalAssets = "$3,100,000",
  timeRemaining = "04:59",
  onConfirm,
  onCancel,
  onCannotPay,
}: Props) {
  const [properties] = useState<Property[]>(PROPERTIES);
  const grouped = groupByArea(properties);

  return (
    <>
      <style>{GLOBAL_STYLE}</style>

      <div className="bg-[#131313] text-[#e5e2e1] font-['Work_Sans'] min-h-screen flex items-center justify-center p-6">
        <div className="max-w-6xl w-full border-4 border-[#d4a017] bg-[#0e0e0e] modal-shadow relative">

          {/* ── Modal Header ── */}
          <header className="bg-[#353534] border-b-2 border-[#d4a017] p-8 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBdNOC-EO_v2uGMNmgdbT3OcSCHRVqDg9guInjorV1BlanGlWFEXxMNxMU_ocYFj2yQtNrsFYpwrca05A_ypPzQVtEOUW_OsPDHq1-7tymnt43oGcA-MF74h0PzCPNQ75SK5xG2tlSv3zVU4G8SQunZdxMPzs37jJ-1jwN_4yenQq6h9-hiMGOTDpmaiZbFZcsMVdZPizEoWRr5ddqSQtiBU7mfpXDSgmWdFHAQQ1ithFSp2g-wTqfEN1qLqSxQF7U1WARgswexYGw')",
              }}
            />
            <h1 className="gold-glow font-['Noto_Serif'] text-5xl text-[#f6be39] font-bold uppercase tracking-tighter">
              THANH LÝ TÀI SẢN
            </h1>
            <p className="font-['Barlow_Condensed'] text-[#bdcabe] tracking-[0.4em] uppercase mt-2">
              Giao diện Thanh Lý &amp; Trả Nợ
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

            {/* ── Left: Debt Status ── */}
            <section className="lg:col-span-4 border-r-2 border-[#d4a017]/30 p-8 flex flex-col justify-between bg-[#1c1b1b]">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined icon-filled text-[#ffb4ab]">priority_high</span>
                  <h2 className="font-['Barlow_Condensed'] text-xl text-[#e5e2e1] uppercase tracking-widest font-bold">
                    Debt Status
                  </h2>
                </div>

                {/* Debt amount */}
                <div className="text-center py-10 bg-[#0e0e0e] border border-[#4f4634]/20 mb-8 relative">
                  <p className="font-['Barlow_Condensed'] text-[#ffb4ab] text-sm uppercase tracking-widest mb-2">
                    Total Arrears
                  </p>
                  <p className="debt-glow font-['Noto_Serif'] text-4xl text-[#ffb4ab] font-bold">
                    {totalDebt}
                  </p>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#353534] px-4 py-1 border border-[#d4a017]">
                    <span className="font-['Barlow_Condensed'] text-[#f6be39] font-bold tracking-widest text-sm">
                      URGENT
                    </span>
                  </div>
                </div>

                {/* Timer */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-['Barlow_Condensed'] uppercase tracking-widest text-[#bdcabe]">
                    <span>Time Remaining</span>
                    <span className="text-[#e5e2e1] font-bold">{timeRemaining}</span>
                  </div>
                  <div className="w-full h-2 bg-[#2a2a2a]">
                    <div className="h-full bg-[#ffb4ab] w-4/5" />
                  </div>
                </div>
              </div>

              {/* Warning quote */}
              <div className="mt-12 p-6 border-2 border-[#ffb4ab]/30 bg-[#ffb4ab]/5">
                <p className="font-['Work_Sans'] text-sm text-[#d3c5ae] italic leading-relaxed">
                  "Sự thất bại trong việc thanh toán nợ cho Ngân Hàng Hoàng Gia sẽ dẫn đến phá sản
                  ngay lập tức và bị tước bỏ mọi danh hiệu còn lại."
                </p>
              </div>
            </section>

            {/* ── Right: Asset List ── */}
            <section className="lg:col-span-8 flex flex-col">
              {/* Scrollable list */}
              <div className="grow overflow-hidden flex flex-col">
                <div className="p-8 h-[600px] overflow-y-auto space-y-10">
                  <div className="flex justify-between items-end">
                    <h3 className="font-['Noto_Serif'] text-2xl text-[#e5e2e1] font-bold tracking-tight">
                      Danh sách tài sản sở hữu
                    </h3>
                    <p className="font-['Barlow_Condensed'] text-[#bdcabe] text-xs uppercase tracking-widest">
                      {properties.length} Địa điểm khả dụng
                    </p>
                  </div>

                  {Object.entries(grouped).map(([area, props]) => (
                    <div key={area}>
                      {/* Area heading */}
                      <div
                        className="border-l-4 pl-4 mb-4"
                        style={{ borderColor: props[0].areaColor }}
                      >
                        <h4
                          className="font-['Barlow_Condensed'] font-bold uppercase tracking-[0.2em] text-sm"
                          style={{ color: props[0].areaColor }}
                        >
                          Khu Vực: {area}
                        </h4>
                      </div>

                      <div className="grid gap-6">
                        {props.map((p) =>
                          p.status === "mortgaged" ? (
                            <MortgagedCard key={p.id} property={p} />
                          ) : (
                            <ActiveCard key={p.id} property={p} />
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary bar */}
                <div className="bg-[#353534]/80 backdrop-blur-md border-t-2 border-[#d4a017] p-4 flex justify-between items-center">
                  <div>
                    <p className="font-['Barlow_Condensed'] text-[#bdcabe] text-xs uppercase tracking-[0.2em]">
                      Tổng giá trị tài sản khả dụng
                    </p>
                    <p className="gold-glow font-['Noto_Serif'] text-2xl text-[#f6be39] font-bold">
                      {totalAssets}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-['Barlow_Condensed'] text-[#bdcabe] text-xs uppercase tracking-[0.2em]">
                      Số tiền còn thiếu
                    </p>
                    <p className="font-['Noto_Serif'] text-lg text-[#ffb4ab] font-bold">{totalDebt}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Footer ── */}
          <footer className="bg-[#0e0e0e] p-6 border-t-2 border-[#d4a017] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-2 border-[#bdcabe] flex items-center justify-center shrink-0">
                <span className="font-['Barlow_Condensed'] text-[#bdcabe] font-bold">!</span>
              </div>
              <p className="font-['Barlow_Condensed'] text-[#bdcabe] text-xs uppercase tracking-widest leading-tight">
                Giá trị thanh lý: Bán nhà{" "}
                <span className="text-[#f6be39]">50%</span>, Cầm cố{" "}
                <span className="text-[#f6be39]">50%</span> và Bán Sổ Đỏ{" "}
                <span className="text-[#f6be39]">90%</span> thị giá.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onCancel}
                className="px-8 py-3 bg-[#353534] text-[#e5e2e1] font-['Barlow_Condensed'] font-bold uppercase tracking-widest border border-[#4f4634] hover:bg-[#2a2a2a] active:scale-95 transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              {onCannotPay && (
                <button
                  onClick={onCannotPay}
                  className="px-8 py-3 bg-[#dc2626] text-white font-['Barlow_Condensed'] font-bold uppercase tracking-widest border border-[#dc2626] hover:bg-[#b91c1c] active:scale-95 transition-all cursor-pointer"
                >
                  Không Thể Thanh Toán
                </button>
              )}
              <button
                onClick={onConfirm}
                className="px-10 py-3 bg-linear-to-r from-[#f6be39] to-[#d4a017] text-[#261a00] font-['Barlow_Condensed'] font-bold uppercase tracking-widest shadow-[0_4px_15px_rgba(212,160,23,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer border-0"
              >
                Xác Nhận Thanh Khoản
              </button>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
