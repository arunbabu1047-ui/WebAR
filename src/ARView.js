import { useEffect, useRef, useState } from "react";

const imageTargetSrc = process.env.PUBLIC_URL
  ? `${process.env.PUBLIC_URL}/targets1.mind`
  : "/targets1.mind";
const modelSrc = process.env.PUBLIC_URL
  ? `${process.env.PUBLIC_URL}/model.glb`
  : "/model.glb";

const overlayStyle = {
  position: "absolute",
  inset: "1rem auto auto 1rem",
  maxWidth: "min(32rem, calc(100% - 2rem))",
  padding: "0.75rem 1rem",
  borderRadius: "0.75rem",
  background: "rgba(15, 23, 42, 0.78)",
  color: "#f8fafc",
  fontSize: "0.95rem",
  lineHeight: 1.5,
  zIndex: 2,
};

const ARView = () => {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Preparing AR experience...");

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      setStatus("AR preview is disabled during tests.");
      return undefined;
    }

    let mindarThree;
    let renderer;
    let clock;
    let animationMixer;
    let animatedModel;
    let revealProgress = 0;
    let targetVisible = false;
    const finalScale = 2.35;
    const hiddenScale = 0.001;
    const revealHeight = 0.22;
    const revealSpeed = 1.2;
    const tiltStart = -0.25;
    const finalTilt = -0.78;
    const animationTimeScale = 0.45;
    const xOffset = 0;
    const yOffset = 0.14;
    let cancelled = false;

    const startAR = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        setStatus("Requesting camera access...");

        const [{ MindARThree }, THREE, { GLTFLoader }] = await Promise.all([
          import("mind-ar/dist/mindar-image-three.prod.js"),
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
        ]);

        if (cancelled) {
          return;
        }

        mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc,
        });

        const { renderer: arRenderer, scene, camera } = mindarThree;
        renderer = arRenderer;
        clock = new THREE.Clock();

        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
        scene.add(new THREE.DirectionalLight(0xffffff, 0.8));

        const anchor = mindarThree.addAnchor(0);
        const loader = new GLTFLoader();

        anchor.onTargetFound = () => {
          targetVisible = true;
          setStatus("Image found. Bringing the model out of the target.");
        };

        anchor.onTargetLost = () => {
          targetVisible = false;
          setStatus("Point your camera at the target image.");
        };

        loader.load(
          modelSrc,
          (gltf) => {
            if (cancelled) {
              return;
            }

            const model = gltf.scene;
            model.scale.set(hiddenScale, hiddenScale, hiddenScale);
            model.position.set(xOffset, yOffset, 0);
            animatedModel = model;

            if (gltf.animations?.length) {
              animationMixer = new THREE.AnimationMixer(model);
              gltf.animations.forEach((clip) => {
                const action = animationMixer.clipAction(clip);
                action.timeScale = animationTimeScale;
                action.play();
              });
            }

            anchor.group.add(model);
            setStatus("Point your camera at the target image.");
          },
          undefined,
          () => {
            if (!cancelled) {
              setStatus(
                "The 3D model could not be loaded. Check public/model.glb and try again.",
              );
            }
          },
        );

        await mindarThree.start();

        if (cancelled) {
          return;
        }

        renderer.setAnimationLoop(() => {
          const delta = clock.getDelta();

          if (animationMixer) {
            animationMixer.update(delta);
          }

          if (animatedModel) {
            const direction = targetVisible ? 1 : -1;
            revealProgress = THREE.MathUtils.clamp(
              revealProgress + direction * delta * revealSpeed,
              0,
              1,
            );

            const easedReveal = THREE.MathUtils.smoothstep(
              revealProgress,
              0,
              1,
            );
            const currentScale = THREE.MathUtils.lerp(
              hiddenScale,
              finalScale,
              easedReveal,
            );

            animatedModel.scale.set(currentScale, currentScale, currentScale);
            animatedModel.position.x = xOffset;
            animatedModel.position.y = yOffset;
            animatedModel.position.z = THREE.MathUtils.lerp(
              0,
              revealHeight,
              easedReveal,
            );
            animatedModel.rotation.x = THREE.MathUtils.lerp(
              tiltStart,
              finalTilt,
              easedReveal,
            );
            animatedModel.rotation.y = 0.12;
            animatedModel.rotation.z = 0;
          }

          renderer.render(scene, camera);
        });
      } catch (error) {
        if (!cancelled) {
          setStatus(
            "AR could not start. Verify camera permission and the target file in public/targets1.mind.",
          );
        }
      }
    };

    startAR();

    return () => {
      cancelled = true;

      if (renderer) {
        renderer.setAnimationLoop(null);
      }

      if (mindarThree) {
        mindarThree.stop();

        if (mindarThree.renderer) {
          mindarThree.renderer.dispose();
        }
      }
    };
  }, []);

  return (
    <div
      data-testid="ar-view"
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={overlayStyle}>{status}</div>
    </div>
  );
};

export default ARView;
