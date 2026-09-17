const STATS = [
  { value: "<10s", label: "Average auto-reply time" },
  { value: "24/7", label: "Automated coverage" },
  { value: "10x", label: "Faster broadcast sends" },
  { value: "0", label: "Code required to launch" },
];

export default function Stats() {
  return (
    <section className="border-y border-emerald-950/5 bg-[#FAFDFA] py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 sm:grid-cols-4 lg:px-8">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-[2rem] font-extrabold tracking-tight text-[#0F5132] sm:text-[2.5rem]">
              {stat.value}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-[#64756D]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl px-6 text-center text-[12px] text-[#94A3A0]">
        Illustrative targets for a well-configured automation — your results depend on your flows and traffic.
      </p>
    </section>
  );
}
