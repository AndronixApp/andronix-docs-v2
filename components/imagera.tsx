import React from "react";
import Image from "next/image";

export default function Imagera({
                                   src,
                                   height = 400,
                                   alt = "image"
                               }: { src: string, height?: number, alt?: string }) {

    return (
        <div>
            <br/>
            <Image className={"mt-4"} src={src} unoptimized={src.includes(".gif")} alt={alt} width={200} height={height}/>
        </div>
    )
}
