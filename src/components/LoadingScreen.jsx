import { useEffect, useRef } from "react";
import lottie from "lottie-web";

export default function LoadingScreen() {
  const container = useRef(null);

  useEffect(() => {
    const animation = lottie.loadAnimation({
      container: container.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "/loading.json"
    });

    return () => animation.destroy();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div ref={container} style={{ width: 200, height: 200 }}></div>
    </div>
  );
}
