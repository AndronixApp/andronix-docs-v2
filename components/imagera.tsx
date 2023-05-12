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
            {!src.includes(".gif") ?
                <Image className={"mt-4"} src={src} unoptimized={src.includes(".gif")} alt={alt} width={200}
                       height={height}/> :
                <img className={"mt-4"} src={src} alt={alt} width={200} height={height}/>
            }
        </div>
    )
}
