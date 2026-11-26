export function RegisterHero() {
  return (
    <section className="flex flex-col justify-center gap-6">
      <div className="inline-flex w-fit items-center rounded-full border border-slate-200/70 bg-white/70 px-4 py-1 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <span className="font-semibold text-slate-900 dark:text-white">O2S</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
        Order To Ship
      </div>
      <div className="space-y-4">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Create your account.
        </h1>
        <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Fill in your details to get started.
        </p>
      </div>
    </section>
  )
}

