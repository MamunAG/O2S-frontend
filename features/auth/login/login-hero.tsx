const WORKFLOW_STEPS = ["Costing", "Orders", "Factory", "Production", "Shipment"]

export function LoginHero() {
  return (
    <section className="flex flex-col justify-center gap-3 lg:gap-6">
      <div className="inline-flex w-fit items-center rounded-full border border-slate-200/70 bg-white/70 px-4 py-1 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Code Crafter X
      </div>
      <div className="space-y-2 lg:space-y-4">
        <h1 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Garment manufacturing, end to end.
        </h1>
        <p className="hidden max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 lg:block">
          Cost your styles, receive buyer orders, place them with your factories, track production and
          ship on time, all in one workspace built for garment manufacturers.
        </p>
      </div>
      <ol className="hidden flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 lg:flex">
        {WORKFLOW_STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 font-medium shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              {step}
            </span>
            {index < WORKFLOW_STEPS.length - 1 ? (
              <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
