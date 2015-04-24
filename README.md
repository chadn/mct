# Metra: Until Next Train
# My Commute

## OVERVIEW

This is a simple web-based app providing real-time info for riders of the Chicago Metra Train system.

Displays how many minutes until the next train arrives at given Metra station, using the Metra Real-Time Tracker API.  That is, if train is scheduled to arrive in 10 mins, but is running 5 mins late, the app will let you know you have 15 minutes till next train.

## Features

- At top of page, shows "10 mins till Next Train" 
- Displays at least next 3 trains and their scheduled and estimated arrival times.  If you leave the app open long enough it will keep adding the next trains as the day progresses.  
- Train line, origin statin, and destination station are dictated by URL.  That means its easy for metra commuters to bookmark it in browser or to copy paste URL to friends
- Simple design, mobile first
- By default, will ping API every 30 secs to for latest info on trains, and update page accordingly.  Can be disabled, or refresh frequency can be changed by adding URL parameter.  For example, to check every 10 secs, add &R=10 to end of URL

## Usage

- First time users must first choose train line, then origin station, the destination station
- Click on metra logo in top left to choose new train line or station
- Most recent choices are remembered and listed at bottom.  No login required, choices are stored in browser cookies.  Invalid station choices are not remembered.

## Background

I am a metra commuter, and metra trains are not always on time.  For a few years now, they have real-time info on all their trains, but the info is not as easy to get as I wanted.  I wanted a super simple page, no login required, that i can save in my bookmarks, that worked on mobile devices (iphone, android, etc) and on desktop, that just told me when the next trains were, and if they were running late.

Caveat - After using this for a month or so, the data from the API is not always accurate. For example, if there's a problem, even Metra is not sure when a train will arrive, so they provide a guesstimate.  Hopefully in the future they will provide a confidence score with times for these situations.



