function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

const DETAIL_NOTES = {
  pid: {
    useCases: [
      "Use PID when the loop is mostly single-input/single-output, the dominant behavior is monotonic or lightly oscillatory, and the plant does not change too much across the operating range.",
      "It is a good first controller for speed, temperature, pressure, flow, and simple position loops because it can be tuned from data even when a first-principles model is unavailable.",
      "Avoid relying on plain PID when there are strong constraints, severe coupling between states, large delays, or a resonance that sits close to the desired bandwidth."
    ],
    derivation: [
      "Start from the tracking error \\(e(t)=r(t)-y(t)\\). The proportional term \\(K_p e(t)\\) is the first-order correction: if output is below reference, push upward; if it is above reference, push downward.",
      "A constant load disturbance often leaves a nonzero steady-state error under proportional control. Adding \\(K_i\\int e(t)dt\\) creates an internal state that keeps growing until the required bias input is produced.",
      "Derivative action approximates future error by the local slope: \\(e(t+\\Delta t)\\approx e(t)+\\Delta t\\dot e(t)\\). The term \\(K_d\\dot e(t)\\) therefore acts like damping, but practical implementations use \\(K_d s/(1+sT_f)\\) to avoid amplifying sensor noise indefinitely."
    ],
    pidCompare: "PID is the baseline. Its value is simplicity, but its limitations define why the other methods exist: resonance needs filtering, coupling needs state-space design, constraints need MPC, and uncertainty needs robust control."
  },
  "feedforward-pid": {
    useCases: [
      "Use feedforward when a large part of the required input is predictable from the reference or a measured load.",
      "Typical examples are robot joints with gravity compensation, motion stages following known acceleration profiles, and thermal systems where load changes are measured before the temperature drifts.",
      "If the model is badly wrong, feedforward can make the loop worse, so it should be paired with feedback and saturation checks."
    ],
    derivation: [
      "Assume a nominal plant equation \\(m\\ddot y+b\\dot y=u+d\\). If the desired trajectory is \\(r(t)\\), the input that would produce it in the nominal model is \\(u_{ff}=m\\ddot r+b\\dot r\\).",
      "The feedback controller then sees the residual dynamics: \\(m\\ddot e+b\\dot e=u_{fb}+d+\\Delta(y,\\dot y)\\). In other words, PID no longer has to create the entire motion command; it mainly corrects disturbances and modeling errors.",
      "For robot manipulators, the same idea becomes inverse dynamics: \\(\\tau_{ff}=M(q)\\ddot q_d+C(q,\\dot q)\\dot q_d+g(q)\\), with feedback stabilizing the residual tracking error."
    ],
    pidCompare: "Compared with pure PID, feedforward reaches the reference with less lag and less integral buildup because the controller is not waiting for error before acting."
  },
  "notch-lead-lag": {
    useCases: [
      "If the system shakes violently at one fixed frequency, a Notch Filter is often the most direct fix because it removes loop gain near that resonance.",
      "Lead compensation is mainly used to increase phase margin near crossover, so the loop can be faster without becoming oscillatory.",
      "Lag compensation is used when low-frequency tracking accuracy is poor but high-frequency noise amplification must remain limited."
    ],
    derivation: [
      "Closed-loop stability is strongly shaped by loop transfer \\(L(s)=C(s)P(s)\\). At the gain crossover frequency, phase margin measures how far the loop is from \\(-180^\\circ\\), where negative feedback turns into positive feedback.",
      "A lead compensator \\(C_{lead}(s)=K(\\tau s+1)/(\\alpha\\tau s+1)\\), \\(0<\\alpha<1\\), places the zero before the pole. This contributes positive phase around \\(\\omega\\approx1/(\\tau\\sqrt{\\alpha})\\), increasing phase margin.",
      "A notch filter places a pair of zeros and poles around \\(\\omega_n\\). Choosing \\(\\zeta_z<\\zeta_p\\) creates attenuation near \\(\\omega_n\\), reducing excitation of a flexible mode while leaving most other frequencies nearly unchanged."
    ],
    pidCompare: "Compared with PID, notch/lead-lag directly changes the frequency response. PID may excite a resonance while chasing faster tracking; a notch suppresses that resonant band and lead adds phase margin."
  },
  "gain-scheduling": {
    useCases: [
      "Use gain scheduling when the plant behavior changes predictably with a measurable operating condition, such as aircraft speed, motor load, battery voltage, altitude, or robot arm configuration.",
      "A single PID or LQR may work well at one point and poorly elsewhere; scheduling allows each region to use gains matched to local dynamics.",
      "It is not a replacement for validation between grid points. The transitions themselves are part of the controller."
    ],
    derivation: [
      "A nonlinear plant \\(\\dot x=f(x,u,\\rho)\\) is approximated near operating points \\(\\rho_i\\) by local linear models \\(\\dot{\\tilde x}=A_i\\tilde x+B_i\\tilde u\\).",
      "For each local model, design gains \\(K_i\\). During operation, interpolate \\(K(\\rho)=\\sum_i w_i(\\rho)K_i\\), where the weights sum to one.",
      "The hidden issue is that \\(K(\\rho(t))\\) changes with time. Fast variation of \\(\\rho\\) can inject extra dynamics, so smooth interpolation and transient testing are essential."
    ],
    pidCompare: "Compared with one fixed PID, gain scheduling keeps the response more consistent as the plant changes. The animation highlights a changing operating point where fixed PID becomes underdamped."
  },
  "pole-placement": {
    useCases: [
      "Use pole placement when you have a reliable low-order state-space model and want direct control over modal speed and damping.",
      "It is useful for teaching, prototype state feedback, and systems where desired eigenvalues can be chosen from settling time and damping requirements.",
      "It is less attractive when actuator effort matters strongly, because pole placement itself does not optimize effort."
    ],
    derivation: [
      "With state feedback \\(u=-Kx\\), the closed-loop system becomes \\(\\dot x=(A-BK)x\\). Its solution is \\(x(t)=e^{(A-BK)t}x(0)\\), so the eigenvalues of \\(A-BK\\) control decay and oscillation.",
      "For a second-order pair, desired poles are often \\(p_{1,2}=-\\zeta\\omega_n\\pm j\\omega_n\\sqrt{1-\\zeta^2}\\). Larger \\(\\omega_n\\) gives speed; larger \\(\\zeta\\) gives damping.",
      "The assignment is possible only if the controllability matrix \\([B\\;AB\\;\\cdots\\;A^{n-1}B]\\) has full rank."
    ],
    pidCompare: "Compared with PID, pole placement shapes all modeled state modes directly. PID sees only error at the output, while state feedback can damp internal modes before they dominate the output."
  },
  lqr: {
    useCases: [
      "Use LQR when multiple states are coupled and a local linear model is good enough. LQR naturally handles coupling because \\(A\\), \\(B\\), \\(Q\\), and \\(R\\) are matrices, not independent scalar loops.",
      "It is strong for balancing systems, aerospace attitude control, vehicles, and robotics where different states trade against each other.",
      "Do not expect LQR to respect hard actuator or state constraints unless additional logic is added."
    ],
    derivation: [
      "For \\(\\dot x=Ax+Bu\\), define the value function \\(V(x)=x^TPx\\). The Hamilton-Jacobi-Bellman condition for infinite-horizon quadratic cost is \\(0=\\min_u[x^TQx+u^TRu+\\dot V]\\).",
      "Because \\(\\dot V=2x^TP(Ax+Bu)\\), minimizing over \\(u\\) gives \\(2Ru+2B^TPx=0\\), so \\(u=-R^{-1}B^TPx=-Kx\\).",
      "Substituting this minimizing input back into the HJB equation yields the algebraic Riccati equation \\(A^TP+PA-PBR^{-1}B^TP+Q=0\\). Coupling appears naturally through the off-diagonal terms of \\(A\\), \\(B\\), \\(Q\\), and \\(P\\)."
    ],
    pidCompare: "Compared with multiple independent PID loops, LQR designs one coordinated feedback law. If position, velocity, angle, and rate interact, LQR can trade them off in one cost function."
  },
  lqi: {
    useCases: [
      "Use LQI when LQR gives good transient behavior but the system still needs zero steady-state tracking error under constant disturbances.",
      "It is common for servo tracking, flight-path control, and multivariable processes where integral action is needed but independent PID integrators are clumsy.",
      "It must be paired with anti-windup or constraint handling when actuators saturate."
    ],
    derivation: [
      "Let the output be \\(y=Cx\\) and the tracking error be \\(e=r-y\\). Define an integral state \\(z=\\int(r-Cx)dt\\), so \\(\\dot z=r-Cx\\).",
      "The augmented state is \\(x_a=[x^T\\;z^T]^T\\). LQR is then applied to \\(\\dot x_a=A_ax_a+B_au+E_ar\\), producing \\(u=-K_xx-K_zz\\).",
      "At steady state with constant reference and no saturation, \\(\\dot z=0\\) implies \\(r-Cx=0\\), which is the offset-free tracking condition."
    ],
    pidCompare: "Compared with PID, LQI adds integral action in a coordinated state-space way. It is especially useful when multiple outputs need integral correction without fighting each other."
  },
  "kalman-lqr": {
    useCases: [
      "Use Kalman + LQR when the state needed by LQR is not directly measured or measurements are noisy.",
      "Examples include drones, spacecraft, navigation systems, and robots where position, velocity, attitude, and bias are reconstructed from multiple sensors.",
      "It is not magic filtering: wrong noise covariance, unmodeled bias, or delay can make the estimate look smooth while being wrong."
    ],
    derivation: [
      "The estimator prediction is \\(\\hat x^-_k=A\\hat x_{k-1}+Bu_{k-1}\\), with covariance \\(P^-_k=AP_{k-1}A^T+Q_n\\).",
      "The innovation \\(y_k-C\\hat x^-_k\\) measures the disagreement between sensor and prediction. The Kalman gain \\(L_k=P^-_kC^T(CP^-_kC^T+R_n)^{-1}\\) weights this innovation by relative uncertainty.",
      "The update is \\(\\hat x_k=\\hat x^-_k+L_k(y_k-C\\hat x^-_k)\\). LQR then uses \\(u_k=-K\\hat x_k\\). Under linear Gaussian assumptions, the separation principle allows estimator and controller design to be separated."
    ],
    pidCompare: "Compared with PID acting on noisy output error, Kalman + LQR estimates the hidden state first. The feedback law reacts to a physically consistent state estimate rather than raw measurement noise."
  },
  mpc: {
    useCases: [
      "MPC's biggest advantage is constraint handling. Use it when inputs, rates, temperatures, voltages, positions, safety envelopes, or collision boundaries are first-class requirements.",
      "It is strong for multivariable systems where today's input affects future feasibility, such as process control, autonomous driving, energy management, and constrained robotics.",
      "It is overkill for very fast simple loops unless the optimization can run reliably inside the sample time."
    ],
    derivation: [
      "At time \\(k\\), MPC solves an optimization over predicted states \\(x_{k+i|k}\\) and inputs \\(u_{k+i|k}\\). The model recursively enforces \\(x_{i+1}=Ax_i+Bu_i\\).",
      "The finite-horizon cost balances state error and effort, while constraints \\(x_i\\in\\mathcal X\\), \\(u_i\\in\\mathcal U\\), and \\(\\Delta u_i\\in\\mathcal D\\) are imposed directly.",
      "Only the first input is applied. At the next sample, the horizon shifts forward and the problem is solved again. This receding-horizon structure gives feedback even though each optimization is open-loop over the horizon."
    ],
    pidCompare: "Compared with PID, MPC does not merely clip an unsafe command after it is computed. It plans a trajectory that avoids violating constraints in the first place."
  },
  hinf: {
    useCases: [
      "H∞ Control cares about this question: even if the model is not exact and external disturbances exist, can the system remain stable and not perform too badly?",
      "Use it when worst-case disturbance amplification matters more than nominal optimality, especially in aerospace, precision instruments, flexible structures, and uncertain plants.",
      "It is most useful when performance, noise, and control effort can be expressed through meaningful weighting functions."
    ],
    derivation: [
      "Build a generalized plant with disturbance input \(w\), control input \(u\), measured output \(y\), and regulated output \(z\). The controller closes the loop and produces a transfer matrix \(T_{zw}(s)\).",
      "The H∞ norm is the largest singular value over all frequencies: \(\|T_{zw}\|_\infty=\sup_\omega\bar\sigma(T_{zw}(j\omega))\). It measures worst-case energy gain from disturbance to performance output.",
      "For a SISO loop, the key closed-loop objects are sensitivity \(S=(I+PK)^{-1}\), complementary sensitivity \(T=PK(I+PK)^{-1}\), and control sensitivity \(KS\). A mixed-sensitivity design often minimizes \(\|[W_1S\; W_2KS\; W_3T]^T\|_\infty\).",
      "The weights are not cosmetic. \(W_1\) encodes low-frequency tracking and disturbance rejection, \(W_2\) limits actuator effort, and \(W_3\) suppresses high-frequency noise and unmodeled dynamics. A bad weight choice gives a mathematically valid but physically poor controller.",
      "Synthesis seeks a stabilizing controller such that \(\|T_{zw}\|_\infty<\gamma\). In state-space algorithms this condition is solved through coupled Riccati or LMI-style feasibility tests, then the resulting high-order controller is reduced and validated."
    ],
    pidCompare: "Compared with PID tuned for a nominal plant, H∞ deliberately sacrifices some nominal speed to keep performance bounded under disturbance and model uncertainty."
  },
  "mu-synthesis": {
    useCases: [
      "Use μ-synthesis when uncertainty is structured: mass varies in one block, actuator gain in another, sensor dynamics in another, and neglected flexible modes in another.",
      "It is relevant for high-consequence robust control where saying 'the model is uncertain' is not enough; the structure of that uncertainty matters.",
      "It is specialist machinery and should be justified by certification or robustness requirements."
    ],
    derivation: [
      "Robust stability can be framed as an interconnection between a nominal transfer matrix \(M\) and uncertainty \(\Delta\). The question is whether \(I-M\Delta\) can become singular for allowable \(\Delta\).",
      "The small-gain theorem gives a simple unstructured test: if \(\|M\|_\infty<1\), then the loop is stable for every \(\|\Delta\|_\infty\le 1\). This is safe but conservative when the uncertainty has known block structure.",
      "The structured singular value \(\mu_\Delta(M)\) measures the smallest structured uncertainty that can destabilize the loop. If \(\mu_\Delta(M(j\omega))<1\) over frequency, the system is robust to the modeled uncertainty set.",
      "D-K iteration alternates between controller synthesis and scaling: D-scales estimate the structured robustness bound, then H∞ synthesis is run on the scaled problem. The scaling step tries to expose which uncertainty block is most dangerous at each frequency.",
      "The method is powerful because it can distinguish actuator uncertainty, sensor uncertainty, parameter variation, and neglected flexible modes. It is difficult because the result depends heavily on whether those uncertainty blocks were modeled honestly."
    ],
    pidCompare: "Compared with PID, μ-synthesis is not about hand tuning one response. It designs against a structured family of possible plants and tries to keep all of them stable and acceptable."
  },
  "reinforcement-learning": {
    useCases: [
      "Use RL when the task is nonlinear, high-dimensional, difficult to model, and can be trained safely in simulation or with constrained exploration.",
      "Good examples include legged locomotion, game-like decision systems, manipulation with rich observations, and policies that must exploit complex contact dynamics.",
      "Avoid RL as a first answer for safety-critical control unless a supervisory safety layer, validation pipeline, and fallback controller exist."
    ],
    derivation: [
      "RL models control as a Markov decision process with state \(s_t\), action \(a_t\), transition distribution, reward \(r_t\), and policy \(\pi_\theta(a|s)\).",
      "The value function satisfies the Bellman relation \(V^\pi(s)=\mathbb E_\pi[r(s,a)+\gamma V^\pi(s')]\). This equation is the dynamic-programming backbone behind value iteration, Q-learning, actor-critic methods, and model-based RL.",
      "The objective is expected discounted return \(J(\pi_\theta)=\mathbb E[\sum_t\gamma^tr_t]\). Policy-gradient methods estimate \(\nabla_\theta J\) using sampled rollouts and an advantage estimate \(A_t\), which measures whether an action was better than expected.",
      "In continuous control, deterministic actor-critic methods often use \(\nabla_\theta J\approx\mathbb E[\nabla_a Q(s,a)|_{a=\mu_\theta(s)}\nabla_\theta\mu_\theta(s)]\). This makes RL look like optimizing a nonlinear feedback law with data rather than solving a Riccati equation.",
      "For control, reward design usually combines tracking error, energy, smoothness, constraint violation, and safety penalties. The mathematical objective may be simple, but the engineering challenge is making exploration and deployment safe."
    ],
    pidCompare: "Compared with PID, RL can represent nonlinear policies learned from data, but it gives up much of PID's transparency and usually needs a safety wrapper or model-based baseline."
  }
};

function renderPage() {
  const item = getAlgorithm(window.PAGE_SLUG);
  const root = document.getElementById("algorithmPage");
  if (!item || !root) return;
  const notes = DETAIL_NOTES[item.slug] || DETAIL_NOTES.pid;

  root.innerHTML = `
    <header class="site-header">
      <nav class="nav">
        <a class="brand" href="../index.html">Control Atlas</a>
        <div class="nav-links">
          <a href="#principle">Principle</a>
          <a href="#use-cases">Use Cases</a>
          <a href="#derivation">Derivation</a>
          <a href="#demo">Demo</a>
          <a href="#implementation">Code</a>
          <a href="#references">References</a>
          <a href="../overview.html">Overview</a>
        </div>
      </nav>
    </header>
    <main>
      <section class="detail-hero">
        <div>
          <p class="eyebrow">${item.family}</p>
          <h1>${item.title}</h1>
          <p>${item.short}</p>
          <div class="formula math">${item.formula}</div>
        </div>
        <div class="detail-card">
          <h2>Quick Read</h2>
          <dl>
            <div><dt>Model need</dt><dd>${item.comparison[2]}</dd></div>
            <div><dt>Constraint handling</dt><dd>${item.comparison[3]}</dd></div>
            <div><dt>Core risk</dt><dd>${item.comparison[4]}</dd></div>
          </dl>
        </div>
      </section>

      <section class="detail-layout" id="principle">
        <article class="content-panel">
          <p class="eyebrow">Principle</p>
          <h2>How It Works</h2>
          ${item.principle.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          <h3>Design Procedure</h3>
          ${list(item.design)}
        </article>
        <aside class="content-panel compact-panel">
          <h3>Advantages</h3>
          ${list(item.advantages)}
          <h3>Limitations</h3>
          ${list(item.limitations)}
          <h3>Application Areas</h3>
          ${list(item.applications)}
        </aside>
      </section>

      <section class="section" id="use-cases">
        <div class="section-heading">
          <p class="eyebrow">When to use it</p>
          <h2>Application Scenarios and Engineering Signals</h2>
        </div>
        <div class="insight-grid">
          ${notes.useCases.map((text) => `<div><p>${text}</p></div>`).join("")}
        </div>
      </section>

      <section class="detail-layout" id="derivation">
        <article class="content-panel wide-panel">
          <p class="eyebrow">Mathematical derivation</p>
          <h2>From Objective to Controller</h2>
          ${notes.derivation.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </article>
        <aside class="content-panel compact-panel compare-note">
          <h3>Compared with PID</h3>
          <p>${notes.pidCompare}</p>
        </aside>
      </section>

      <section class="section" id="demo">
        <div class="section-heading">
          <p class="eyebrow">Behavior animation</p>
          <h2>Advantage Shown Against a PID Baseline</h2>
          <p id="demoCaption"></p>
        </div>
        <div class="legend-row">
          <span><i class="legend-line pid-line"></i> PID baseline</span>
          <span><i class="legend-line method-line"></i> ${item.title}</span>
          <span><i class="legend-line effort-line"></i> control effort / constraint signal</span>
        </div>
        <div class="demo-shell">
          <canvas id="detailCanvas" width="1120" height="560"></canvas>
        </div>
      </section>

      <section class="detail-layout" id="implementation">
        <article class="content-panel">
          <p class="eyebrow">Implementation</p>
          <h2>Code Sketch</h2>
          <pre><code>${escapeHtml(item.code)}</code></pre>
        </article>
        <aside class="content-panel compact-panel">
          <h3>Verification Checklist</h3>
          <ul>
            <li>Check units, signs, and sampling time.</li>
            <li>Simulate saturation, delay, noise, and sensor dropout.</li>
            <li>Validate stability margins before field testing.</li>
            <li>Log reference, output, control effort, and constraint activity.</li>
          </ul>
        </aside>
      </section>

      <section class="section" id="references">
        <div class="section-heading">
          <p class="eyebrow">Research and source references</p>
          <h2>Further Reading</h2>
        </div>
        <div class="reference-list">
          ${item.references.map((ref) => `<a href="${ref.url}" target="_blank" rel="noreferrer">${ref.text}</a>`).join("")}
        </div>
      </section>
    </main>
    <footer class="footer"><p><a href="../index.html">Back to Control Algorithms Atlas</a></p></footer>
  `;

  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise();
  }
  drawDetailDemo(item.slug);
}

function responseSeries(slug) {
  const profiles = {
    pid: { zeta: 0.43, wn: 3.0, delay: 0.0, ripple: 0.015, effort: 1.1 },
    "feedforward-pid": { zeta: 0.78, wn: 4.4, delay: -0.12, ripple: 0.006, effort: 0.82 },
    "notch-lead-lag": { zeta: 0.7, wn: 3.4, delay: 0.0, ripple: 0.035, effort: 0.9, filteredRipple: true },
    "gain-scheduling": { zeta: 0.62, wn: 2.4, delay: 0.0, ripple: 0.01, effort: 0.92, schedule: true },
    "pole-placement": { zeta: 0.72, wn: 3.8, delay: 0.0, ripple: 0.006, effort: 1.25 },
    lqr: { zeta: 0.82, wn: 3.5, delay: 0.0, ripple: 0.004, effort: 0.75 },
    lqi: { zeta: 0.76, wn: 2.7, delay: 0.0, ripple: 0.004, effort: 0.82, disturbanceReject: true },
    "kalman-lqr": { zeta: 0.82, wn: 3.3, delay: 0.0, ripple: 0.04, effort: 0.7, estimated: true },
    mpc: { zeta: 1.05, wn: 2.7, delay: 0.0, ripple: 0.002, effort: 0.55, constrained: true },
    hinf: { zeta: 0.95, wn: 2.6, delay: 0.0, ripple: 0.004, effort: 0.68, uncertainty: true },
    "mu-synthesis": { zeta: 0.9, wn: 2.5, delay: 0.0, ripple: 0.004, effort: 0.72, structured: true },
    "reinforcement-learning": { zeta: 0.55, wn: 2.2, delay: 0.0, ripple: 0.015, effort: 0.8, learning: true },
  };
  const p = profiles[slug] || profiles.pid;
  const series = [];
  const dt = 0.025;
  for (let i = 0; i <= 320; i += 1) {
    const t = i * dt;
    const tt = Math.max(0, t - Math.max(0, p.delay));
    const wd = p.wn * Math.sqrt(Math.max(0.01, 1 - p.zeta * p.zeta));
    let y = 1 - Math.exp(-p.zeta * p.wn * tt) * (Math.cos(wd * tt) + (p.zeta / Math.sqrt(Math.max(0.01, 1 - p.zeta * p.zeta))) * Math.sin(wd * tt));
    let baseline = y;

    if (p.schedule && t > 3.2) {
      y += 0.13 * Math.exp(-1.1 * (t - 3.2)) * Math.sin(7 * (t - 3.2));
    }
    if (p.disturbanceReject && t > 3.0) {
      y -= 0.18 * Math.exp(-1.25 * (t - 3.0));
    }
    if (p.constrained) {
      y = Math.min(1.015, y);
    }
    if (p.learning) {
      const improvement = 0.28 * Math.exp(-0.42 * t);
      y = 1 - (1 - y) * (1 + improvement) + 0.08 * Math.exp(-0.35 * t) * Math.sin(8 * t);
    }
    const ripple = p.filteredRipple ? p.ripple * Math.sin(20 * t) * Math.exp(-0.16 * t) : p.ripple * Math.sin(23 * t);
    const measured = y + ripple;
    const estimate = p.estimated ? y + 0.004 * Math.sin(4 * t) : null;
    const effort = p.effort * Math.exp(-0.55 * t) * Math.sin(2.6 * t + 1.1) + (p.constrained ? Math.min(0.55, 0.95 * Math.exp(-0.6 * t)) : 0);
    series.push({ t, y, baseline, measured, estimate, effort });
  }
  return series;
}

function drawDetailDemo(slug) {
  const canvas = document.getElementById("detailCanvas");
  if (!canvas) return;
  const caption = document.getElementById("demoCaption");
  const captions = {
    pid: "The PID baseline shows the familiar trade-off: faster response usually means more overshoot and more actuator impulse.",
    "feedforward-pid": "Compared with PID, feedforward gets closer to the desired trajectory before feedback error accumulates.",
    "notch-lead-lag": "PID excites a resonant band; notch compensation suppresses the fixed-frequency vibration, and lead-style shaping improves damping.",
    "gain-scheduling": "Fixed PID degrades when the operating point changes; scheduled gains keep the response consistent across the transition.",
    "pole-placement": "PID only reacts through output error, while pole placement moves modeled closed-loop modes to desired damping and speed.",
    lqr: "LQR coordinates coupled states and uses less effort than independent PID-like correction for the same settling behavior.",
    lqi: "PID and LQI both integrate error, but LQI does it in a coordinated state-space design and rejects the disturbance cleanly.",
    "kalman-lqr": "PID reacts to noisy measured error; Kalman + LQR filters the state first, reducing noise-driven control activity.",
    mpc: "PID asks for a command and then saturates it; MPC plans a constrained trajectory that avoids violating the input limit.",
    hinf: "PID can be fast on the nominal model but fragile under uncertainty; H∞ keeps a bounded worst-case response.",
    "mu-synthesis": "PID is tuned for one plant; μ-synthesis is designed against structured plant variations and keeps sampled plants bounded.",
    "reinforcement-learning": "PID is fixed after tuning; the learned policy can improve nonlinear behavior over rollouts but needs safety supervision."
  };
  caption.textContent = captions[slug] || captions.pid;

  const ctx = canvas.getContext("2d");
  const data = responseSeries(slug);
  const pidData = responseSeries("pid").map((p) => scenarioAdjust("pid-baseline", slug, p));
  const methodData = data.map((p) => scenarioAdjust("method", slug, p));
  let frame = 0;

  function draw() {
    frame = (frame + 1) % data.length;
    const w = canvas.width;
    const h = canvas.height;
    const pad = { l: 70, r: 36, t: 40, b: 62 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const x = (t) => pad.l + (t / 8) * plotW;
    const y = (v) => pad.t + (1.35 - v) / 1.75 * plotH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    drawDemoGrid(ctx, pad, plotW, plotH);
    drawPath(ctx, methodData, x, (p) => y(1), "#9aa8b4", 2, [8, 8], methodData.length);
    drawPath(ctx, pidData, x, (p) => y(p.y), "#c65345", 2.4, [], frame);

    if (slug === "notch-lead-lag") {
      drawPath(ctx, pidData, x, (p) => y(p.y), "#c65345", 2.4, [], frame);
    }
    if (slug === "kalman-lqr") {
      drawPath(ctx, methodData, x, (p) => y(p.measured), "#b77a1b", 1.6, [], frame);
      drawPath(ctx, methodData, x, (p) => y(p.estimate), "#007c89", 3.5, [], frame);
    } else if (slug === "hinf" || slug === "mu-synthesis") {
      drawBand(ctx, methodData, x, y, slug === "hinf" ? 0.065 : 0.045, frame);
      drawPath(ctx, methodData, x, (p) => y(p.y), "#007c89", 3.5, [], frame);
    } else {
      drawPath(ctx, methodData, x, (p) => y(p.y), "#007c89", 3.5, [], frame);
    }

    drawPath(ctx, methodData, x, (p) => y(0.18 + p.effort * 0.32), "#b77a1b", 2, [], frame);
    drawSpecialOverlay(ctx, slug, pad, plotW, plotH, frame, methodData);
    requestAnimationFrame(draw);
  }
  draw();
}

function scenarioAdjust(kind, slug, p) {
  const q = { ...p };
  const disturbance = p.t > 3.0 ? Math.exp(-1.25 * (p.t - 3.0)) : 0;
  if (kind === "pid-baseline") {
    if (slug === "notch-lead-lag") q.y += 0.16 * Math.sin(20 * p.t) * Math.exp(-0.08 * p.t);
    if (slug === "gain-scheduling" && p.t > 3.2) q.y += 0.22 * Math.exp(-0.75 * (p.t - 3.2)) * Math.sin(6.5 * (p.t - 3.2));
    if (slug === "lqr") q.y += 0.06 * Math.sin(7 * p.t) * Math.exp(-0.35 * p.t);
    if (slug === "lqi") q.y -= 0.23 * disturbance;
    if (slug === "kalman-lqr") q.y += 0.045 * Math.sin(24 * p.t);
    if (slug === "mpc") q.y = Math.min(1.2, q.y + 0.18 * Math.exp(-0.55 * p.t));
    if (slug === "hinf") q.y += 0.12 * Math.sin(4.2 * p.t) * Math.exp(-0.08 * p.t);
    if (slug === "mu-synthesis") q.y += 0.14 * Math.sin(3.6 * p.t + 0.4) * Math.exp(-0.08 * p.t);
    if (slug === "reinforcement-learning") q.y += 0.13 * Math.sin(5.2 * p.t) * Math.exp(-0.18 * p.t);
  }
  return q;
}

function drawDemoGrid(ctx, pad, plotW, plotH) {
  ctx.strokeStyle = "#e8eef2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(pad.l + (i / 8) * plotW, pad.t);
    ctx.lineTo(pad.l + (i / 8) * plotW, pad.t + plotH);
    ctx.stroke();
  }
  for (let i = 0; i <= 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + (i / 7) * plotH);
    ctx.lineTo(pad.l + plotW, pad.t + (i / 7) * plotH);
    ctx.stroke();
  }
  ctx.strokeStyle = "#b8c5cf";
  ctx.strokeRect(pad.l, pad.t, plotW, plotH);
  ctx.fillStyle = "#465564";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText("reference / output", 18, 30);
  ctx.fillText("time", pad.l + plotW / 2, pad.t + plotH + 42);
}

function drawPath(ctx, data, xScale, yScale, color, width, dash, end) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  data.slice(0, Math.max(2, end)).forEach((p, i) => {
    const px = xScale(p.t);
    const py = yScale(p);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

function drawBand(ctx, data, xScale, yScale, band, end) {
  const shown = data.slice(0, Math.max(2, end));
  ctx.fillStyle = "rgba(0, 124, 137, 0.12)";
  ctx.beginPath();
  shown.forEach((p, i) => {
    const px = xScale(p.t);
    const py = yScale(p.y + band * Math.exp(-0.1 * p.t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  shown.slice().reverse().forEach((p) => {
    ctx.lineTo(xScale(p.t), yScale(p.y - band * Math.exp(-0.1 * p.t)));
  });
  ctx.closePath();
  ctx.fill();
}

function drawSpecialOverlay(ctx, slug, pad, plotW, plotH, frame, data) {
  ctx.fillStyle = "#12355b";
  ctx.font = "800 16px system-ui, sans-serif";
  if (slug === "mpc") {
    ctx.fillText("input limit active", pad.l + plotW - 170, pad.t + 30);
    ctx.strokeStyle = "#c65345";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + plotH * 0.19);
    ctx.lineTo(pad.l + plotW, pad.t + plotH * 0.19);
    ctx.stroke();
  }
  if (slug === "gain-scheduling") {
    const xSwitch = pad.l + (3.2 / 8) * plotW;
    ctx.fillText("gain schedule transition", xSwitch + 12, pad.t + 52);
    ctx.strokeStyle = "#c65345";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(xSwitch, pad.t);
    ctx.lineTo(xSwitch, pad.t + plotH);
    ctx.stroke();
  }
  if (slug === "reinforcement-learning") {
    const episode = 1 + Math.floor((frame / data.length) * 100);
    ctx.fillText(`policy rollout improving`, pad.l + plotW - 210, pad.t + 30);
    ctx.fillStyle = "#64707d";
    ctx.fillText(`episode signal: ${episode}`, pad.l + plotW - 210, pad.t + 55);
  }
}

renderPage();
