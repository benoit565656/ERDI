'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PublicLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isFullWidthPage = pathname === '/data-explorer' || pathname === '/indicators' || pathname === '/country-outlook' || pathname === '/api-docs' || pathname === '/api';

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:300;400;500;600;700&family=Montserrat:300;400;500;600;700&family=Poppins:300;400;500;600;700&family=Raleway:300;400;500;600;700&display=swap" />
      
      <style>{`
        @media screen and (min-width: 768px) {
          .nav-menu.w-nav-menu {
            display: flex !important;
            position: static !important;
            background: transparent !important;
            float: none !important;
          }
          .nav-links {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            position: static !important;
            width: auto !important;
            height: auto !important;
            background: transparent !important;
            align-items: center !important;
            justify-content: flex-end !important;
          }
          .link-navigation {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      
      {/* HEADER SECTION - EXACT EXTRACTED WEBFLOW MARKUP WITH ABSOLUTE RESOURCE PATHS */}
      <div className="header" style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <section className="section-header">
          <div data-animation="over-right" className="navbar w-nav" data-easing2="ease" data-easing="ease" data-collapse="medium" role="banner" data-no-scroll="1" data-duration="400" data-doc-height="1">
            <div className="container w-container" style={isFullWidthPage ? { maxWidth: 'none', width: '100%', paddingLeft: '24px', paddingRight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              
              {/* Brand Logo */}
              <Link href="/index.html" className="brand w-nav-brand">
                <img loading="lazy" src="/images/logo-adb-erdi.webp" alt="ADB ERDI Logo" className="image" style={{ height: '50px', width: 'auto' }} height="50" />
              </Link>
              
              {/* Hamburger Button for Mobile */}
              <div className="container-menu-button">
                <div 
                  id="menu_button" 
                  className={`menu-button w-nav-button ${mobileMenuOpen ? 'w--open' : ''}`}
                  onClick={toggleMobileMenu}
                >
                  <img loading="lazy" src="/images/hamburger-md-svgrepo-com.svg" alt="Menu" className="image-2" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                </div>
              </div>
              
              {/* Navigation Menu */}
              <nav role="navigation" className={`nav-menu w-nav-menu ${mobileMenuOpen ? 'w--open' : ''}`} style={mobileMenuOpen ? { display: 'block', transform: 'translateX(0px)', transition: 'transform 400ms ease 0s' } : { display: 'flex', alignItems: 'center' }}>
                <div className="nav-links" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', flexWrap: 'nowrap', gap: '8px' }}>
                  
                  <Link href="/data-explorer" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/chart-bar.svg" alt="Data Explorer" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">Data Explorer</div>
                  </Link>
                  <div className="separator-nav"></div>

                  <Link href="/indicators" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/search.svg" alt="Indicators" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">Indicators</div>
                  </Link>
                  <div className="separator-nav"></div>

                  <Link href="/country-outlook" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/users-group.svg" alt="Country Outlook" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">Country Outlook</div>
                  </Link>
                  <div className="separator-nav"></div>

                  <Link href="/api-docs" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/chart-bar.svg" alt="API Documentation" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px', filter: 'hue-rotate(180deg)' }} />
                    <div className="text-block">API Documentation</div>
                  </Link>
                  <div className="separator-nav"></div>
                  
                  <a href="/knowledge-hub.html" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/news.svg" alt="Knowledge Hub" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">Knowledge Hub</div>
                  </a>
                  <div className="separator-nav"></div>
                  
                  <a href="/events.html" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/calendar-event.svg" alt="Events" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">Events</div>
                  </a>
                  <div className="separator-nav"></div>
                  
                  <a href="/our-people.html" className="link-navigation w-inline-block" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <img loading="lazy" src="/images/users-group.svg" alt="People" className="image-3" width="25" height="25" style={{ width: '25px', height: '25px' }} />
                    <div className="text-block">People</div>
                  </a>
                  
                </div>
              </nav>
            </div>
          </div>
        </section>
        
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div 
            id="nav_overlay" 
            className="nav-overlay" 
            style={{ display: 'block', opacity: 0.5, pointerEvents: 'auto', transition: 'opacity 0.5s ease 0s' }}
            onClick={toggleMobileMenu}
          ></div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: '1 0 auto' }}>
        {children}
      </main>

      {/* FOOTER SECTION - EXACT EXTRACTED WEBFLOW MARKUP WITH ABSOLUTE RESOURCE PATHS */}
      <section className="footer">
        <div className="container-footer" style={isFullWidthPage ? { maxWidth: 'none', width: '100%', paddingLeft: '24px', paddingRight: '24px' } : {}}>
          <div id="w-node-_35309f21-7068-e1a8-8dfe-64361b9ae162-1b9ae160" className="w-layout-layout quick-stack-2 wf-layout-layout">
            
            <div className="w-layout-cell cell-3">
              <img loading="lazy" src="/images/Webclip_ADB.png" alt="ADB logo" className="image-5" />
              <div className="title-footer">ABOUT ADB</div>
              <div className="copy-footer">
                ADB is a leading multilateral development bank supporting inclusive, resilient, and sustainable growth across Asia and the Pacific. Working with its members and partners to solve complex challenges together, ADB harnesses innovative financial tools and strategic partnerships to transform lives, build quality infrastructure, and safeguard our planet. Founded in 1966, ADB is owned by 69 members—50 from the region.
              </div>
            </div>
            
            <div className="w-layout-cell cell-4">
              <div className="title-footer">HEADQUARTERS</div>
              <div className="copy-footer">
                6 ADB Avenue,<br />Mandaluyong City 1550,<br />Metro Manila,<br />Philippines
              </div>
            </div>
            
            <div className="w-layout-cell cell-5">
              <div className="title-footer">LINKS</div>
              <a href="/index.html" className="link-footer">Home</a>
              <Link href="/data-explorer" className="link-footer data">Data Explorer</Link>
              <Link href="/indicators" className="link-footer">Indicators</Link>
              <Link href="/country-outlook" className="link-footer">Country Outlook</Link>
              <a href="/knowledge-hub.html" className="link-footer">Knowledge Hub</a>
              <a href="/events.html" className="link-footer">Events</a>
              <a href="/our-people.html" className="link-footer">People</a>
              <a href="https://d2yvooigui2x99.cloudfront.net/search-publications.html" className="link-footer search">Search</a>
            </div>
            
          </div>
          
          <div className="footer-bottom">
            <div className="copy-footer v2">© 2026 Asian Development Bank. All rights reserved.</div>
            <div className="div-block-2">
              <a href="https://www.adb.org/who-we-are/access-information" target="_blank" className="link-footer v2">Access to Information</a>
              <div className="text-block-5">•</div>
              <a href="https://www.adb.org/who-we-are/integrity" target="_blank" className="link-footer v2">Anticorruption and Integrity</a>
              <div className="text-block-5">•</div>
              <a href="https://www.adb.org/terms-use" target="_blank" className="link-footer v2">Terms of Use</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
