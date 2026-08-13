import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import * as THREE from "three";
import { MessageCircle, Loader2, ArrowLeft } from "lucide-react";

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}

interface SignInPageProps {
  className?: string;
  onSubmit?: (email: string, password: string) => Promise<void> | void;
  loading?: boolean;
}

export const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[125, 211, 252]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={cn("h-full relative w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[125, 211, 252]]}
          dotSize={dotSize ?? 3}
          opacities={opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]}
          shader={`
            ${reverse ? "u_reverse_active" : "false"}_;
            animation_speed_factor_${animationSpeed.toFixed(1)}_;
          `}
          center={["x", "y"]}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"],
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length === 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]),
        type: "uniform3fv",
      },
      u_opacities: {
        value: opacities,
        type: "uniform1fv",
      },
      u_total_size: {
        value: totalSize,
        type: "uniform1f",
      },
      u_dot_size: {
        value: dotSize,
        type: "uniform1f",
      },
      u_reverse: {
        value: shader.includes("u_reverse_active") ? 1 : 0,
        type: "uniform1i",
      },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }
        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${
              center.includes("x")
                ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }
            ${
              center.includes("y")
                ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);


            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                 opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                 opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                 opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                 opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }


            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  uniforms: Uniforms;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  let lastFrameTime = 0;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();

    lastFrameTime = timestamp;

    const material: any = ref.current.material;
    const timeLocation = material.uniforms.u_time;
    timeLocation.value = timestamp;
  });

  const getUniforms = () => {
    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {
        case "uniform1f":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1f" };
          break;
        case "uniform1i":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1i" };
          break;
        case "uniform3f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: "3f",
          };
          break;
        case "uniform1fv":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1fv" };
          break;
        case "uniform3fv":
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: number[]) => new THREE.Vector3().fromArray(v)),
            type: "3fv",
          };
          break;
        case "uniform2f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: "2f",
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }

    preparedUniforms["u_time"] = { value: 0, type: "1f" };
    preparedUniforms["u_resolution"] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };

  const material = useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return materialObject;
  }, [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0  h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

export const SignInPage = ({ className, onSubmit, loading = false }: SignInPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "success">("credentials");
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (onSubmit) {
      try {
        await onSubmit(email, password);
        triggerSuccess();
      } catch {
        // error handled by parent
      }
    } else {
      triggerSuccess();
    }
  };

  const triggerSuccess = () => {
    setReverseCanvasVisible(true);
    setTimeout(() => {
      setInitialCanvasVisible(false);
    }, 50);
    setTimeout(() => {
      setStep("success");
    }, 2000);
  };

  const handleBackClick = () => {
    setStep("credentials");
    setReverseCanvasVisible(false);
    setInitialCanvasVisible(true);
  };

  return (
    <div className={cn("flex w-[100%] flex-col min-h-screen bg-background relative", className)}>
      <div className="absolute inset-0 z-0">
        {initialCanvasVisible && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={3}
              containerClassName="bg-black"
              colors={[
                [125, 211, 252],
                [56, 189, 248],
              ]}
              dotSize={5}
              reverse={false}
            />
          </div>
        )}

        {reverseCanvasVisible && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={4}
              containerClassName="bg-black"
              colors={[
                [125, 211, 252],
                [56, 189, 248],
              ]}
              dotSize={5}
              reverse={true}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-background to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Top header */}
        <header className="w-full p-6 lg:p-10 flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}
          >
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">
              SISTEMA INTERNO
            </span>
            <span className="text-xs text-muted-foreground">WhatsApp Automation</span>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Form side */}
          <div className="flex-1 flex flex-col justify-center items-center px-6 pb-10">
            <div className="w-full max-w-sm">
              <AnimatePresence mode="wait">
                {step === "credentials" ? (
                  <motion.div
                    key="credentials-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-8"
                  >
                    <div className="space-y-2 text-center lg:text-left">
                      <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-foreground">
                        Bem-vindo de volta
                      </h1>
                      <p className="text-base text-muted-foreground">
                        Acesse o painel de automação
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                          Email
                        </label>
                        <div className="relative">
                          <input
                            id="email"
                            type="email"
                            placeholder="operador@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full backdrop-blur-sm text-foreground border border-border bg-card/60 rounded-full py-3 px-5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="password"
                          className="text-sm font-medium text-foreground/80"
                        >
                          Senha
                        </label>
                        <div className="relative">
                          <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full backdrop-blur-sm text-foreground border border-border bg-card/60 rounded-full py-3 px-5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                            required
                          />
                          <button
                            type="submit"
                            disabled={loading || !email || !password}
                            className="absolute right-1.5 top-1.5 text-primary-foreground w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-50 transition-all group overflow-hidden hover:scale-105"
                            style={{ background: "var(--gradient-primary)" }}
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="relative w-full h-full block overflow-hidden">
                                <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                                  →
                                </span>
                                <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 -translate-x-full group-hover:translate-x-0">
                                  →
                                </span>
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>

                    <p className="text-xs text-muted-foreground text-center lg:text-left pt-4">
                      Acesso restrito. Credenciais gerenciadas pelo administrador.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-step"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-2">
                      <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-foreground">
                        Acesso autorizado
                      </h1>
                      <p className="text-base text-muted-foreground">
                        Redirecionando para o painel...
                      </p>
                    </div>

                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="py-8"
                    >
                      <div
                        className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-primary-foreground"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      onClick={handleBackClick}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right side: branding (only on large screens) */}
          <div className="hidden lg:flex flex-1 flex-col justify-center px-12 xl:px-20 -mt-25">                                                           
            <div className="max-w-lg space-y-6"> 
              <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-foreground">
                Automação inteligente de <span className="glow-text text-primary">WhatsApp</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Gerencie suas conversas, contatos e fluxos de atendimento em um só lugar.
                Performance, segurança e controle total para sua operação.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-6">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground">99.9%</div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground">24/7</div>
                  <div className="text-xs text-muted-foreground">Suporte</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
