#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common libdot util code."""

from __future__ import print_function

import argparse
import logging
import logging.handlers
import os
import subprocess
import sys
import time


BIN_DIR = os.path.dirname(os.path.realpath(__file__))
DIR = os.path.dirname(BIN_DIR)
LIBAPPS_DIR = os.path.dirname(DIR)


def setup_logging(debug=False):
    """Setup the logging module."""
    fmt = u'%(asctime)s: %(levelname)-7s: '
    if debug:
        fmt += u'%(filename)s:%(funcName)s: '
    fmt += u'%(message)s'

    # 'Sat, 05 Oct 2013 18:58:50 -0400 (EST)'
    tzname = time.strftime('%Z', time.localtime())
    datefmt = u'%a, %d %b %Y %H:%M:%S ' + tzname

    level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(fmt, datefmt)
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(level)


def html_test_runner_parser():
    """Get a parser for our test runner."""
    parser = argparse.ArgumentParser(
        description='HTML test runner',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('-d', '--debug', action='store_true',
                        help='Run with debug output.')
    parser.add_argument('--browser', default=os.getenv('CHROME_BIN'),
                        help='Browser program to run tests against.')
    parser.add_argument('--profile', default=os.getenv('CHROME_TEST_PROFILE'),
                        help='Browser profile dir to run against.')
    return parser


def html_test_runner_main(argv, path):
    """Open the test page at |path|."""
    parser = html_test_runner_parser()
    opts = parser.parse_args(argv)
    setup_logging(debug=opts.debug)

    # Try to use default X session.
    os.environ.setdefault('DISPLAY', '0:0')

    # Set up a unique profile to avoid colliding with user settings.
    profile_dir = opts.profile
    if not profile_dir:
        profile_dir = os.path.expanduser('~/.config/google-chrome-run_local')
    os.makedirs(profile_dir, exist_ok=True)

    # Chrome goes by many names.  We know them all!
    browser = opts.browser
    if not browser:
        for suffix in ('', '-stable', '-beta', '-unstable', '-trunk'):
            browser = 'google-chrome%s' % (suffix,)
            try:
                subprocess.check_call([browser, '--version'])
                break
            except (FileNotFoundError, subprocess.CalledProcessError):
                pass
        else:
            parser.error('Could not find a browser; please use --browser.')

    # Kick off test runner in the background so we exit.
    logging.info('Running tests against browser "%s".', browser)
    logging.info('Tests page: %s', path)
    subprocess.Popen([browser, '--user-data-dir=%s' % (profile_dir,), path])
