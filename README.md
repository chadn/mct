# MCT - My Commute Train - Chicago Metra

## OVERVIEW

This is a simple web-based app providing real-time info for riders communting on the Chicago Metra Train system.

Displays how many minutes until the next train arrives at given Metra station, using the Metra Real-Time Tracker API.  That is, if train is scheduled to arrive in 5 mins, but is running 10 mins late, the app lets you know you have 15 minutes till next train.

<img alt="Train 10 mins late, arrives in 15 mins" src="https://github.com/chadn/mct/blob/master/images/mct-2015-04-25.png" width="419" height="541">

## Features

- THE BLUE BOX!! Highlights in a blue box number of minutes till your next train. Based on the train stations chosen and real-time data from Chicago Metra's API. This is why I made the app. :)
- Displays at least the next 3 trains and their scheduled and estimated arrival times.  If you leave the app open long enough it will keep adding the next trains as the day progresses.  
- Train line, origin statin, and destination station are dictated by URL.  That means its easy for metra commuters to bookmark it in browser or to copy paste URL to friends
- Simple design, mobile first
- By default, will ping API every 30 secs to for latest info on trains, and update page accordingly.  Can be disabled, or refresh frequency can be changed by adding URL parameter.  For example, to check every 10 secs, add &R=10 to end of URL

## Usage

- First time users must first choose train line, then origin station, the destination station.  Note that if destination station is at the end of the line, times will not be available (limitation of Metra API)
- Choose New Train by clicking on link at bottom or on metra logo in top left
- Most recent choices are remembered and listed at bottom.  No login required, choices are stored in browser cookies.  Invalid station choices are not remembered.

## Accuracy and Feedback

The estimate from the API is not always accurate. For example, if there is a problem, Metra may not be sure when a train will arrive, so they provide a guesstimate.  

Click on Feedback link on right under the train table to let us know if estimate was early, late, on time, or varied (changed a few times).  

## Background

I am a metra commuter, and metra trains are not always on time.  For a few years now, they have real-time info on all their trains, but the info is not as easy to get as I wanted.  I wanted a super simple page, no login required, that i can save in my bookmarks, that worked on mobile devices (iphone, android, etc) and on desktop, that just told me when the next trains were, and if they were running late.


