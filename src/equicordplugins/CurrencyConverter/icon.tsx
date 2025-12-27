const DOLLAR_PATH =
    "M12 2a10 10 0 100 20 10 10 0 000-20Zm1 15h-2v-1.1c-1.2-.3-2-1.2-2-2.4h2c0 .6.4 1 1 1h1c.6 0 1-.4 1-1s-.4-1-1-1h-1c-1.7 0-3-1.3-3-3 0-1.2.8-2.1 2-2.4V7h2v1.1c1.2.3 2 1.2 2 2.4h-2c0-.6-.4-1-1-1h-1c-.6 0-1 .4-1 1s.4 1 1 1h1c1.7 0 3 1.3 3 3 0 1.2-.8 2";

export function Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width={24}
            height={24}
            {...props}
        >
            <path d={DOLLAR_PATH} />
        </svg>
    );
}

export function SmallIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width={16}
            height={16}
            {...props}
        >
            <path d={DOLLAR_PATH} />
        </svg>
    );
}
