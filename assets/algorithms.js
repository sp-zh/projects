const ALGORITHMS = [
  {
    slug: "pid",
    title: "PID Control",
    short: "The workhorse feedback loop for SISO regulation and tracking.",
    family: "Classical feedback",
    formula: "\\[u(t)=K_p e(t)+K_i\\int_0^t e(\\tau)\\,d\\tau+K_d\\frac{de(t)}{dt}\\]",
    principle: [
      "PID combines present error, accumulated error, and error trend. The proportional term increases loop stiffness, the integral term removes constant bias, and the derivative term adds damping by reacting to error slope.",
      "In Laplace form, the ideal controller is \\(C(s)=K_p+K_i/s+K_d s\\). Real implementations usually filter the derivative term and clamp or back-calculate the integrator to avoid windup under actuator saturation."
    ],
    design: [
      "Tune proportional gain until the loop is responsive but not oscillatory.",
      "Add integral action slowly to remove steady-state error.",
      "Add filtered derivative only when damping is needed and sensor noise is acceptable."
    ],
    advantages: ["Minimal model requirement", "Cheap embedded implementation", "Easy operator intuition"],
    limitations: ["Integral windup", "Derivative noise amplification", "Weak MIMO handling", "Retuning needed across operating points"],
    applications: ["Temperature loops", "Motor speed", "Pressure and flow control", "Simple position servos"],
    code: `class PID:
    def __init__(self, kp, ki, kd, dt, u_min=-float("inf"), u_max=float("inf")):
        self.kp, self.ki, self.kd, self.dt = kp, ki, kd, dt
        self.u_min, self.u_max = u_min, u_max
        self.i = 0.0
        self.prev_e = 0.0

    def update(self, r, y):
        e = r - y
        d = (e - self.prev_e) / self.dt
        i_candidate = self.i + e * self.dt
        u_raw = self.kp * e + self.ki * i_candidate + self.kd * d
        u = min(self.u_max, max(self.u_min, u_raw))
        if u == u_raw:          # simple anti-windup by conditional integration
            self.i = i_candidate
        self.prev_e = e
        return u`,
    references: [
      { text: "K. J. Åström and T. Hägglund, PID Controllers: Theory, Design, and Tuning.", url: "https://portal.research.lu.se/en/publications/pid-controllers-theory-design-and-tuning" }
    ],
    comparison: ["Tracking error", "Low", "None", "Indirect through saturation logic", "Windup and poor tuning margins"]
  },
  {
    slug: "feedforward-pid",
    title: "Feedforward + PID",
    short: "Predict the needed input, then let feedback clean up model error.",
    family: "Classical plus model compensation",
    formula: "\\[u(t)=u_{ff}(r,\\dot r,\\ddot r)+K_p e(t)+K_i\\int e(t)\\,dt+K_d\\dot e(t)\\]",
    principle: [
      "Feedforward acts before tracking error appears. If a model predicts the input needed for the requested motion or load, the feedback loop no longer has to generate the entire command from error.",
      "For a mass-damper axis, \\(u_{ff}=m\\ddot r+b\\dot r\\). For a robot joint, feedforward may include gravity, Coriolis, and inertia terms from inverse dynamics."
    ],
    design: ["Identify the dominant static or dynamic load", "Add model-based command shaping", "Keep PID for residual disturbance and uncertainty"],
    advantages: ["Faster tracking", "Lower feedback gain requirement", "Reduced lag during planned trajectories"],
    limitations: ["Model error becomes command error", "Can saturate actuators before feedback reacts", "Needs reference derivatives or trajectory generator"],
    applications: ["Motion stages", "Robot joints", "Motor drives", "Thermal systems with measurable load"],
    code: `def feedforward_pid(reference, velocity_ref, accel_ref, measurement, pid, mass, damping):
    u_ff = mass * accel_ref + damping * velocity_ref
    u_fb = pid.update(reference, measurement)
    return u_ff + u_fb`,
    references: [
      { text: "R. Kelly, V. Santibáñez, and A. Loría, Control of Robot Manipulators in Joint Space.", url: "https://link.springer.com/book/10.1007/978-1-4471-0501-5" }
    ],
    comparison: ["Tracking plus model cancellation", "Medium", "None unless added", "Bad feedforward model or saturation"]
  },
  {
    slug: "notch-lead-lag",
    title: "Notch / Lead-Lag Compensation",
    short: "Shape loop gain in frequency domain to manage resonance, phase, and steady-state error.",
    family: "Frequency-domain classical control",
    formula: "\\[G_{notch}(s)=\\frac{s^2+2\\zeta_z\\omega_n s+\\omega_n^2}{s^2+2\\zeta_p\\omega_n s+\\omega_n^2},\\quad \\zeta_z<\\zeta_p\\]",
    principle: [
      "A notch attenuates a narrow resonance, a lead compensator adds positive phase near crossover, and a lag compensator increases low-frequency gain while preserving high-frequency roll-off.",
      "Lead compensation is often written as \\(G_{lead}(s)=K(\\tau s+1)/(\\alpha\\tau s+1)\\), where \\(0<\\alpha<1\\)."
    ],
    design: ["Find resonance and crossover on a Bode plot", "Place notch around the flexible mode", "Use lead for phase margin and lag for steady-state accuracy"],
    advantages: ["Excellent for resonant SISO plants", "Clear frequency-domain interpretation", "Computationally light"],
    limitations: ["Narrow-band fixes can miss drifting resonances", "Manual loop-shaping effort", "Limited multivariable insight"],
    applications: ["Flexible structures", "Disk drives", "Precision stages", "Servo drives"],
    code: `from scipy import signal

def notch(omega_n, zeta_zero, zeta_pole):
    num = [1.0, 2.0 * zeta_zero * omega_n, omega_n**2]
    den = [1.0, 2.0 * zeta_pole * omega_n, omega_n**2]
    return signal.TransferFunction(num, den)`,
    references: [
      { text: "K. Ogata, Modern Control Engineering.", url: "https://www.pearson.com/en-us/subject-catalog/p/modern-control-engineering/P200000003346" }
    ],
    comparison: ["Frequency response shape", "Low to medium", "No", "Frequency drift and unmodeled modes"]
  },
  {
    slug: "gain-scheduling",
    title: "Gain Scheduling",
    short: "Interpolate local controllers across a nonlinear operating envelope.",
    family: "Nonlinear practical control",
    formula: "\\[K(\\rho)=\\sum_{i=1}^{N}w_i(\\rho)K_i,\\qquad \\sum_i w_i(\\rho)=1,\\quad w_i(\\rho)\\ge 0\\]",
    principle: [
      "Instead of one controller for the whole nonlinear plant, gain scheduling designs local controllers at representative operating points and interpolates their gains as a measurable scheduling variable changes.",
      "The scheduling variable \\(\\rho\\) might be airspeed, load, battery voltage, altitude, joint angle, or flow rate."
    ],
    design: ["Pick scheduling variables that are measured reliably", "Linearize or identify plant models at grid points", "Interpolate gains smoothly and validate between grid points"],
    advantages: ["Practical nonlinear coverage", "Compatible with PID, LQR, and observers", "Widely used in industry"],
    limitations: ["No automatic guarantee between grid points", "Fast scheduling can create hidden dynamics", "Validation burden grows with dimension"],
    applications: ["Aircraft flight control", "Engines", "Battery systems", "Robotics with changing configuration"],
    code: `def interpolate_gain(rho, grid, gains):
    if rho <= grid[0]:
        return gains[0]
    if rho >= grid[-1]:
        return gains[-1]
    for i in range(len(grid) - 1):
        if grid[i] <= rho <= grid[i + 1]:
            a = (rho - grid[i]) / (grid[i + 1] - grid[i])
            return (1 - a) * gains[i] + a * gains[i + 1]`,
    references: [
      { text: "W. J. Rugh and J. S. Shamma, Research on gain scheduling, Automatica, 2000.", url: "https://doi.org/10.1016/S0005-1098(99)00189-3" }
    ],
    comparison: ["Local closed-loop behavior", "Medium", "No", "Interpolation instability"]
  },
  {
    slug: "pole-placement",
    title: "Pole Placement",
    short: "Choose closed-loop eigenvalues directly for a controllable state-space model.",
    family: "State-space control",
    formula: "\\[\\dot x=Ax+Bu,\\quad u=-Kx+r,\\quad \\lambda(A-BK)=\\{p_1,\\ldots,p_n\\}\\]",
    principle: [
      "Closed-loop poles define modal decay, oscillation, damping, and speed. If \\((A,B)\\) is controllable, state feedback can assign the eigenvalues of \\(A-BK\\).",
      "For second-order dominant behavior, pole location is often selected from desired natural frequency \\(\\omega_n\\) and damping ratio \\(\\zeta\\)."
    ],
    design: ["Verify controllability", "Choose poles from settling-time and damping requirements", "Check actuator effort and robustness margins"],
    advantages: ["Transparent transient shaping", "Good teaching bridge from classical to state-space", "Works well for low-order systems"],
    limitations: ["Requires state feedback", "No explicit control-effort objective", "Aggressive poles excite neglected dynamics"],
    applications: ["Laboratory plants", "Low-order mechanical systems", "Embedded state-space loops"],
    code: `import numpy as np
from scipy.signal import place_poles

A = np.array([[0.0, 1.0], [-2.0, -0.4]])
B = np.array([[0.0], [1.0]])
K = place_poles(A, B, [-2.0 + 1.5j, -2.0 - 1.5j]).gain_matrix`,
    references: [
      { text: "T. Kailath, Linear Systems.", url: "https://www.worldscientific.com/worldscibooks/10.1142/0600" }
    ],
    comparison: ["Pole locations", "Medium", "No", "Excessive actuator demand"]
  },
  {
    slug: "lqr",
    title: "Linear Quadratic Regulator",
    short: "Optimal state feedback balancing state error and control effort.",
    family: "Optimal control",
    formula: "\\[J=\\int_0^\\infty\\left(x^TQx+u^TRu\\right)dt,\\qquad u=-Kx,\\quad K=R^{-1}B^TP\\]",
    principle: [
      "LQR turns controller tuning into a quadratic optimization problem. The matrix \\(Q\\) penalizes state deviation and \\(R\\) penalizes actuator usage.",
      "The matrix \\(P\\) solves the continuous algebraic Riccati equation \\(A^TP+PA-PBR^{-1}B^TP+Q=0\\)."
    ],
    design: ["Scale states and inputs before choosing Q and R", "Increase Q for states that must be small", "Increase R when actuators are expensive or saturated"],
    advantages: ["Systematic tuning", "Excellent MIMO handling", "Good stability margins under ideal assumptions"],
    limitations: ["Linear model dependence", "Needs state estimates", "No hard constraints"],
    applications: ["Aerospace", "Balancing robots", "Vehicle control", "Precision motion"],
    code: `import numpy as np
from scipy.linalg import solve_continuous_are

def lqr(A, B, Q, R):
    P = solve_continuous_are(A, B, Q, R)
    return np.linalg.solve(R, B.T @ P)`,
    references: [
      { text: "B. D. O. Anderson and J. B. Moore, Optimal Control: Linear Quadratic Methods.", url: "https://www.google.com/books/edition/Optimal_Control/P4TKxn7qW5kC" }
    ],
    comparison: ["Quadratic state and effort cost", "High", "Soft only through cost", "Wrong weights or model mismatch"]
  },
  {
    slug: "lqi",
    title: "Linear Quadratic Integral Control",
    short: "LQR augmented with integral action for zero steady-state tracking error.",
    family: "Optimal tracking control",
    formula: "\\[\\dot z=r-Cx,\\qquad \\frac{d}{dt}\\begin{bmatrix}x\\\\z\\end{bmatrix}=\\begin{bmatrix}A&0\\\\-C&0\\end{bmatrix}\\begin{bmatrix}x\\\\z\\end{bmatrix}+\\begin{bmatrix}B\\\\0\\end{bmatrix}u+\\begin{bmatrix}0\\\\I\\end{bmatrix}r\\]",
    principle: [
      "Plain LQR regulates states toward zero. LQI adds integral states that accumulate output tracking error, giving offset-free tracking under constant disturbances.",
      "The augmented system is controlled with the same Riccati machinery as LQR, but the weighting matrix must include both physical states and integral states."
    ],
    design: ["Choose tracked outputs carefully", "Verify augmented controllability", "Include anti-windup when input saturation is possible"],
    advantages: ["Offset-free tracking", "MIMO-friendly integral action", "Natural upgrade from LQR"],
    limitations: ["Can slow the loop", "Integrator windup under saturation", "Augmented model may lose controllability"],
    applications: ["Servo systems", "Robotics tracking", "Flight-path control", "Process loops with constant disturbances"],
    code: `import numpy as np

def lqi_augmented_model(A, B, C):
    n, m = B.shape
    p = C.shape[0]
    A_aug = np.block([[A, np.zeros((n, p))], [-C, np.zeros((p, p))]])
    B_aug = np.vstack([B, np.zeros((p, m))])
    return A_aug, B_aug`,
    references: [
      { text: "B. D. O. Anderson and J. B. Moore, Optimal Control: Linear Quadratic Methods.", url: "https://www.google.com/books/edition/Optimal_Control/P4TKxn7qW5kC" }
    ],
    comparison: ["Quadratic cost plus tracking integral", "High", "Soft only", "Integral windup and poor output choice"]
  },
  {
    slug: "kalman-lqr",
    title: "Kalman Filter + LQR",
    short: "Estimate hidden states, then apply optimal state feedback.",
    family: "Stochastic optimal control",
    formula: "\\[\\hat x^-_k=A\\hat x_{k-1}+Bu_{k-1},\\quad L_k=P^-_kC^T(CP^-_kC^T+R_v)^{-1},\\quad u_k=-K\\hat x_k\\]",
    principle: [
      "The Kalman filter fuses a model prediction with noisy measurements. LQR acts on the estimated state \\(\\hat x\\), producing the Linear Quadratic Gaussian architecture for linear systems with Gaussian noise.",
      "The separation principle says estimator and controller can be designed separately under ideal linear assumptions."
    ],
    design: ["Model process noise and measurement noise", "Validate delay and bias assumptions", "Tune LQR and estimator bandwidth together in simulation"],
    advantages: ["Works when states are not directly measured", "Noise-aware estimation", "Strong aerospace and robotics track record"],
    limitations: ["Noise covariance tuning is subtle", "Bias and delay can break assumptions", "No hard constraints"],
    applications: ["Navigation", "Drones", "Spacecraft", "Robotics", "Sensor fusion"],
    code: `def kalman_update(x, P, u, y, A, B, C, Qn, Rn):
    x_pred = A @ x + B @ u
    P_pred = A @ P @ A.T + Qn
    S = C @ P_pred @ C.T + Rn
    L = P_pred @ C.T @ np.linalg.inv(S)
    x_new = x_pred + L @ (y - C @ x_pred)
    P_new = (np.eye(P.shape[0]) - L @ C) @ P_pred
    return x_new, P_new`,
    references: [
      { text: "R. E. Kalman, A New Approach to Linear Filtering and Prediction Problems, 1960.", url: "https://doi.org/10.1115/1.3662552" }
    ],
    comparison: ["Expected quadratic cost with noisy measurements", "High", "Soft only", "Bad noise model, delay, or bias"]
  },
  {
    slug: "mpc",
    title: "Model Predictive Control",
    short: "Receding-horizon optimization with constraints.",
    family: "Constrained optimal control",
    formula: "\\[\\min_{u_{0:N-1}}\\sum_{k=0}^{N-1}(x_k^TQx_k+u_k^TRu_k)+x_N^TP_fx_N\\quad \\text{s.t.}\\quad x_{k+1}=Ax_k+Bu_k,\\;x_k\\in\\mathcal X,\\;u_k\\in\\mathcal U\\]",
    principle: [
      "MPC predicts future states over a horizon, solves a constrained optimization problem, applies the first input, and replans at the next sample.",
      "The defining advantage is that constraints are part of the design rather than after-the-fact saturation logic."
    ],
    design: ["Choose horizon long enough to see constraint consequences", "Use terminal costs or terminal sets for stability", "Define infeasibility fallback behavior"],
    advantages: ["Native hard constraints", "Excellent MIMO handling", "Can optimize economic objectives"],
    limitations: ["Online compute", "Model mismatch", "Feasibility and solver reliability"],
    applications: ["Chemical processes", "Autonomous vehicles", "Energy systems", "Robotics with limits"],
    code: `import cvxpy as cp

def mpc_control(A, B, x0, Q, R, u_max, N):
    n, m = B.shape
    x = cp.Variable((n, N + 1))
    u = cp.Variable((m, N))
    cost = 0
    constraints = [x[:, 0] == x0]
    for k in range(N):
        cost += cp.quad_form(x[:, k], Q) + cp.quad_form(u[:, k], R)
        constraints += [x[:, k + 1] == A @ x[:, k] + B @ u[:, k]]
        constraints += [cp.abs(u[:, k]) <= u_max]
    cp.Problem(cp.Minimize(cost), constraints).solve()
    return u[:, 0].value`,
    references: [
      { text: "J. B. Rawlings, D. Q. Mayne, and M. Diehl, Model Predictive Control: Theory, Computation, and Design.", url: "https://sites.engineering.ucsb.edu/~jbraw/mpc/" }
    ],
    comparison: ["Finite-horizon constrained objective", "High", "Native", "Solver failure or infeasibility"]
  },
  {
    slug: "hinf",
    title: "H∞ Control",
    short: "Minimize worst-case disturbance amplification.",
    family: "Robust control",
    formula: "\\[\\|T_{zw}(s)\\|_\\infty=\\sup_{\\omega}\\bar\\sigma\\left(T_{zw}(j\\omega)\\right)<\\gamma\\]",
    principle: [
      "H∞ control asks for a controller that bounds the worst-case gain from disturbance inputs \\(w\\) to regulated outputs \\(z\\). The design is not centered on the nominal trajectory; it is centered on the largest admissible amplification from disturbance to performance output.",
      "Weighting functions shape tracking, control effort, sensor noise, and robustness requirements. A typical generalized plant has the form \\(\\begin{bmatrix} z \\\\ y \\end{bmatrix}=P(s)\\begin{bmatrix} w \\\\ u \\end{bmatrix}\\), and the closed-loop transfer \\(T_{zw}\\) is then minimized in the \\(H_\\infty\\) norm.",
      "A standard choice is to rewrite the design in terms of sensitivity functions. If \\(L(s)=P(s)K(s)\\), then \\(S=(I+L)^{-1}\\) and \\(T=L(I+L)^{-1}\\). Weighting \\(W_1 S\\), \\(W_2 K S\\), and \\(W_3 T\\) lets one encode tracking, effort, and noise rejection in a single inequality."
    ],
    design: ["Build a generalized plant", "Choose performance and robustness weighting functions", "Reduce controller order if needed and validate margins"],
    advantages: ["Explicit worst-case disturbance rejection", "Strong robustness language", "Useful for uncertain high-value systems"],
    limitations: ["Weight selection is difficult", "High-order controllers", "Conservatism compared with nominal optimal control"],
    applications: ["Aerospace", "Precision instruments", "Flexible structures", "Systems with severe uncertainty"],
    code: `# Python-control sketch; exact support depends on installed packages.
import control as ct

P = ct.ss(A, B, C, D)
# K, CL, gamma, info = ct.hinfsyn(P, nmeas=ny, ncon=nu)`,
    references: [
      { text: "G. Zames, Feedback and optimal sensitivity: model reference transformations, multiplicative seminorms, and approximate inverses, 1981.", url: "https://doi.org/10.1109/TAC.1981.1102671" },
      { text: "J. C. Doyle, K. Glover, P. P. Khargonekar, and B. A. Francis, State-space solutions to standard H2 and H∞ control problems, 1989.", url: "https://doi.org/10.1109/9.25303" },
      { text: "K. Zhou, J. C. Doyle, and K. Glover, Robust and Optimal Control, 1996.", url: "https://books.google.com/books?id=UqYqGgAACAAJ" }
    ],
    comparison: ["Worst-case induced gain", "High", "Indirect", "Conservative weights or high-order controller"]
  },
  {
    slug: "mu-synthesis",
    title: "μ-Synthesis",
    short: "Robust control for structured uncertainty.",
    family: "Advanced robust control",
    formula: "\\[\\mu_\\Delta(M)=\\frac{1}{\\min\\{\\bar\\sigma(\\Delta):\\det(I-M\\Delta)=0\\}}\\]",
    principle: [
      "μ-synthesis keeps the structure of uncertainty blocks instead of treating uncertainty as one unstructured norm-bounded perturbation. That structure matters because a 5% sensor-gain error is not the same as a 5% flexible-mode error.",
      "The common practical workflow is D-K iteration: synthesize an H∞ controller for a scaled plant, analyze structured singular value, update scaling, and repeat. The scaling matrices \\(D\\) approximate the size of the smallest destabilizing structured uncertainty.",
      "A useful intuition is that H∞ asks for a small worst-case gain, while μ asks whether the loop remains stable against a block-structured family of perturbations. In practice, the two are often paired: H∞ provides the synthesis step inside D-K iteration, and μ evaluates the structured robustness margin."
    ],
    design: ["Define uncertainty blocks honestly", "Run D-K iteration", "Reduce and validate the controller against sampled uncertain plants"],
    advantages: ["Handles structured uncertainty", "Closer to certification-style robustness", "Powerful for high-consequence systems"],
    limitations: ["Difficult modeling and tuning", "Computational complexity", "Controller order can be impractical"],
    applications: ["Flight control", "Space systems", "Flexible precision systems", "Robust actuator/sensor uncertainty problems"],
    code: `K = initial_hinf_controller(P)
for iteration in range(max_iterations):
    mu_bound, D = structured_singular_value_analysis(P, K)
    P_scaled = apply_d_scaling(P, D)
    K = hinf_synthesis(P_scaled)
    if mu_bound < 1.0:
        break`,
    references: [
      { text: "J. C. Doyle, Analysis of feedback systems with structured uncertainties, 1982.", url: "https://doi.org/10.1049/ip-d.1982.0053" },
      { text: "A. Packard and J. Doyle, The complex structured singular value, Automatica, 1993.", url: "https://doi.org/10.1016/0005-1098(93)90032-S" },
      { text: "S. Skogestad and I. Postlethwaite, Multivariable Feedback Control: Analysis and Design, 2nd ed.", url: "https://www.wiley.com/en-us/Multivariable+Feedback+Control%3A+Analysis+and+Design%2C+2nd+Edition-p-9780470011676" },
      { text: "K. Zhou, J. C. Doyle, and K. Glover, Robust and Optimal Control, 1996.", url: "https://books.google.com/books?id=UqYqGgAACAAJ" }
    ],
    comparison: ["Structured worst-case robustness", "Very high", "Indirect", "Modeling uncertainty incorrectly"]
  },
  {
    slug: "reinforcement-learning",
    title: "Reinforcement Learning Control",
    short: "Learn a policy from interaction and reward.",
    family: "Learning-based control",
    formula: "\\[J(\\pi_\\theta)=\\mathbb E_{\\pi_\\theta}\\left[\\sum_{t=0}^{\\infty}\\gamma^t r(s_t,a_t)\\right],\\qquad \\nabla_\\theta J\\approx\\mathbb E[\\nabla_\\theta\\log\\pi_\\theta(a_t|s_t)A_t]\\]",
    principle: [
      "RL treats control as sequential decision-making. A policy chooses actions, the environment returns rewards, and learning updates the policy to improve expected return.",
      "For physical control, the reward must encode tracking, energy, smoothness, safety, and constraint violation. The hard part is not writing the objective; it is making exploration safe and transfer reliable.",
      "There are two common viewpoints: value-based RL estimates \\(V^\\pi(s)=\\mathbb E_\\pi[\\sum_{k=0}^{\\infty}\\gamma^k r_{t+k} \\mid s_t=s]\\), while policy-gradient RL directly parameterizes \\(\\pi_\\theta(a|s)\\) and improves the expected return through sampled gradients.",
      "Bellman equations make the dynamic-programming connection explicit: \\(V^\\pi(s)=\\mathbb E[r+\\gamma V^\\pi(s_{t+1})]\\). In actor-critic methods, the critic estimates value or advantage and the actor updates the policy using that estimate."
    ],
    design: ["Train in simulation with domain randomization", "Constrain exploration or use offline/safe RL", "Validate against model-based baselines and safety monitors"],
    advantages: ["Can learn nonlinear high-dimensional policies", "Works when analytic control design is hard", "Can exploit data and simulation"],
    limitations: ["Sample inefficient", "Weak guarantees", "Reward hacking", "Sim-to-real gap", "Hard debugging"],
    applications: ["Legged locomotion", "Games", "High-dimensional robotics", "Adaptive policies with rich sensors"],
    code: `for episode in range(num_episodes):
    states, actions, rewards = rollout(env, policy)
    returns = discounted_returns(rewards, gamma=0.99)
    loss = 0.0
    for s, a, G in zip(states, actions, returns):
        loss -= policy.log_prob(s, a) * G
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()`,
    references: [
      { text: "R. S. Sutton and A. G. Barto, Reinforcement Learning: An Introduction.", url: "http://incompleteideas.net/book/the-book-2nd.html" },
      { text: "J. García and F. Fernández, A comprehensive survey on safe reinforcement learning, 2015.", url: "https://doi.org/10.5555/2909829.2909909" },
      { text: "R. S. Sutton et al., Policy Gradient Methods for Reinforcement Learning with Function Approximation, 2000.", url: "https://proceedings.neurips.cc/paper_files/paper/1999/file/464d828b85b0bed98e80ade0a5c43b0f-Paper.pdf" },
      { text: "D. Silver et al., Deterministic Policy Gradient Algorithms, 2014.", url: "https://proceedings.mlr.press/v32/silver14.html" },
      { text: "J. Achiam et al., Constrained Policy Optimization, 2017.", url: "https://proceedings.mlr.press/v70/achiam17a.html" }
    ],
    comparison: ["Expected cumulative reward", "Optional but useful", "Through reward, shields, or constrained RL", "Unsafe exploration and weak guarantees"]
  }
];

function getAlgorithm(slug) {
  return ALGORITHMS.find((item) => item.slug === slug);
}


const OVERVIEW_SCORES = {
  pid: { model: 1, constraints: 1, robustness: 1, computation: 1, note: "baseline, cheap, local" },
  "feedforward-pid": { model: 2, constraints: 1, robustness: 2, computation: 1, note: "model help without much cost" },
  "notch-lead-lag": { model: 2, constraints: 1, robustness: 2, computation: 1, note: "frequency shaping" },
  "gain-scheduling": { model: 3, constraints: 1, robustness: 3, computation: 2, note: "multiple local models" },
  "pole-placement": { model: 3, constraints: 1, robustness: 2, computation: 2, note: "state-space and eigenvalues" },
  lqr: { model: 4, constraints: 1, robustness: 3, computation: 2, note: "optimal state coupling" },
  lqi: { model: 4, constraints: 1, robustness: 3, computation: 2, note: "tracking with integral state" },
  "kalman-lqr": { model: 4, constraints: 1, robustness: 3, computation: 3, note: "estimation plus optimal feedback" },
  mpc: { model: 4, constraints: 5, robustness: 3, computation: 5, note: "constraints are native" },
  hinf: { model: 5, constraints: 2, robustness: 5, computation: 4, note: "worst-case design" },
  "mu-synthesis": { model: 5, constraints: 2, robustness: 5, computation: 5, note: "structured uncertainty" },
  "reinforcement-learning": { model: 2, constraints: 3, robustness: 2, computation: 5, note: "data-driven and expensive" }
};