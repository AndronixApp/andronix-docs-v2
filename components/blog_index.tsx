import { getPagesUnderRoute } from "nextra/context";
import Link from "next/link";

export default function BlogIndex({ more = "Read more" }) {
    return getPagesUnderRoute("/blog").reverse().map((page) => {

        return (
            <div key={page.route} className="mb-10">
                <h3>
                    <Link
                        href={page.route}
                        style={{ color: "inherit", textDecoration: "none" }}
                        className="block font-semibold mt-8 text-2xl "
                    >
                        {/*@ts-ignore*/}
                        {page.meta?.title || page.frontMatter?.title || page.name}
                    </Link>
                </h3>
                <p className="opacity-80 mt-6 leading-7">
                    {/*@ts-ignore*/}
                    {page.frontMatter?.description}{" "}
                    <span className="inline-block">
            <Link
                href={page.route}
                className="text-[color:hsl(var(--nextra-primary-hue),100%,50%)] underline underline-offset-2 decoration-from-font"
            >
              {more + " →"}
            </Link>
          </span>
                </p>
                {/*@ts-ignore*/}
                {page.frontMatter?.date ? (
                    <p className="opacity-50 text-sm mt-6 leading-7">
                        {/*@ts-ignore*/}
                        {page.frontMatter.date}
                    </p>
                ) : null}
            </div>
        );
    });
}