import React from 'react';
import Link from "next/link";
import Image from "next/image";
import {ThemeSwitcher} from '@/components/controls/ThemeSwitcher';


import githubLightIcon from '@/../public/images/svg/github_white.svg';
import githubDarkIcon from '@/../public/images/svg/github.svg';
import {useTheme} from "@/context/ThemeContext";

export function SidebarLogo() {

    const {theme, toggleTheme} = useTheme();

    return (
        <div style={{padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <img
                    src="/logo.svg"
                    alt="SQL Visualizer"
                    style={{width: 30, height: 30, borderRadius: 8, flexShrink: 0}}
                />
                <div>
                    <div style={{fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2}}>
                        SQL Visualizer
                    </div>
                    <div style={{fontSize: 10, color: 'var(--text-muted)'}}>B+Tree Engine · v2</div>
                </div>
                <div style={{marginLeft: 'auto'}}>
                    <ThemeSwitcher/>
                </div>
            </div>
            <div>
                <span className="icon hover-trigger" style={{float: 'right', marginTop: 4}}>
                    <Link href={'https://github.com/ashwin-athappan/sql-execution-visualizer'}
                          target={'_blank'}>
                        {theme === 'dark' ? (
                            <Image height={20} src={githubLightIcon} alt={'github_light_icon'}/>
                        ) : (
                            <Image height={20} src={githubDarkIcon} alt={'github_icon'}/>
                        )}
                    </Link>
                </span>
            </div>
        </div>
    );
}
