import definePlugin from "@utils/types";

export default definePlugin({
    name: "Uptime",
    description: "Displays your current uptime.",
    authors: ["EquicordDevs.bratic"],
    start() {
        const startTime = Date.now();
        const divHtml = `
            <div id="uptime-box" style="
                display: inline-block;
                position: fixed;
                top: 0;
                left: 145px;
                z-index: 9999;
                padding: 6px 12px;
                border-radius: 2px;
                font-size: 13px;
                font-weight: 515;
                font-family: Whitney, Helvetica, sans-serif;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                pointer-events: none;
            "></div>
        `;
        document.body.insertAdjacentHTML("beforeend", divHtml);
        const timerDiv = document.getElementById("uptime-box") as HTMLElement;
        const rootStyle = getComputedStyle(document.documentElement);
        timerDiv.style.backgroundColor = rootStyle.getPropertyValue("--background-secondary") || "#2f3136";
        timerDiv.style.color = rootStyle.getPropertyValue("--text-normal") || "#ffffff";

        function formatTime(ms: number) {
            const totalSeconds = Math.floor(ms / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
                .toString()
                .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
        }
        setInterval(() => {
            const elapsed = Date.now() - startTime;
            timerDiv.textContent = `Uptime: ${formatTime(elapsed)}`;
        }, 1000);
    },
});