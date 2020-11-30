/*
 * JavaScript tracker for Snowplow: tests/functional/integration.spec.js
 *
 * Significant portions copyright 2010 Anthon Pang. Remainder copyright
 * 2012-2020 Snowplow Analytics Ltd. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * * Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * * Neither the name of Anthon Pang nor Snowplow Analytics Ltd nor the
 *   names of their contributors may be used to endorse or promote products
 *   derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import util from 'util'
import F from 'lodash/fp'
import { fetchResults, start, stop } from '../micro'

const dumpLog = log => console.log(util.inspect(log, true, null, true))

const isMatchWithCallback = F.isMatchWith((lt, rt) =>
  F.isFunction(rt) ? rt(lt) : undefined
)

describe('Auto tracking', () => {
  if (F.isMatch({ browserName: 'internet explorer', version: '9' }, browser.capabilities)) {
    fit('Skip IE9', () => {}) // Automated tests for IE autotracking features 
  }

  let log = []
  let docker

  const logContains = ev => F.some(isMatchWithCallback(ev), log)

  beforeAll(() => {
    browser.call(() => {
      return start()
        .then((container) => {
          docker = container
        })
    })
    browser.url('/index.html')
    browser.setCookies({ name: 'container', value: docker.url })
    browser.url('/link-tracking.html')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
  })

  afterAll(() => {
    browser.call(() => {
      return stop(docker.container)
    })
  })

  it('should send a link click event', () => {
    $('#link-to-click').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                targetUrl: 'http://snowplow-js-tracker.local:8080/link-tracking.html#click',
                elementId: 'link-to-click',
                elementClasses: ['example'],
                elementTarget: '_self'
              }
            } 
          },
          contexts: {
            data: [{
              schema: 'iglu:org.schema/WebPage/jsonschema/1-0-0',
              data: { keywords: ['tester'] }
            }]
          }
        },
      })
    ).toBe(true)
  })

  it('should not send a blocked link click event', () => {
    browser.url('/link-tracking.html?filter=exclude')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#link-to-not-track').click()
    $('#link-to-click').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                elementId: 'link-to-not-track'
              }
            } 
          }
        },
      })
    ).toBe(false)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                targetUrl: 'http://snowplow-js-tracker.local:8080/link-tracking.html?filter=exclude#click',
                elementId: 'link-to-click',
                elementClasses: ['example'],
                elementContent: 'Click here',
                elementTarget: '_self'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should not send a filtered link click event', () => {
    browser.url('/link-tracking.html?filter=filter')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#link-to-filter').click()
    $('#link-to-click').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                elementId: 'link-to-filter'
              }
            } 
          }
        },
      })
    ).toBe(false)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                targetUrl: 'http://snowplow-js-tracker.local:8080/link-tracking.html?filter=filter#click',
                elementId: 'link-to-click',
                elementClasses: ['example'],
                elementContent: 'Click here',
                elementTarget: '_self'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should not send a non-allowed link click event', () => {
    browser.url('/link-tracking.html?filter=include')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#link-to-filter').click()
    $('#link-to-click').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
            event: 'unstruct',
            app_id: 'autotracking',
            unstruct_event: {
              data: {
                schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
                data: {
                  elementId: 'link-to-filter'
                }
              } 
            }
        },
      })
    ).toBe(false)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/link_click/jsonschema/1-0-1',
              data: {
                targetUrl: 'http://snowplow-js-tracker.local:8080/link-tracking.html?filter=include#click',
                elementId: 'link-to-click',
                elementClasses: ['example'],
                elementContent: 'Click here',
                elementTarget: '_self'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send focus_form and change_form on text input', () => {
    var expectedFirstName = 'Alex';

    browser.url('/form-tracking.html')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#fname').click()

    // Edge 13 doesn't support setValue so we invert the logic
    // However some browsers don't fire onchange events when clearing...
    if (F.isMatch({ browserName: 'MicrosoftEdge', browserVersion: '25.10586.0.0' }, browser.capabilities)) {
      expectedFirstName = '';
      $('#fname').clearValue()
    } else {
      $('#fname').setValue(expectedFirstName)
    }

    $('#lname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'fname',
                nodeName: 'INPUT',
                elementType: 'text',
                elementClasses: ['test'],
                value: 'John'
              }
            } 
          }
        },
      })
    ).toBe(true)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/change_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'fname',
                nodeName: 'INPUT',
                type: 'text',
                elementClasses: ['test'],
                value: expectedFirstName
              }
            } 
          }
        },
      })
    ).toBe(true)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'lname',
                nodeName: 'INPUT',
                elementType: 'text',
                elementClasses: [],
                value: 'Doe'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send change_form on radio input', () => {
    $('#bike').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/change_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'vehicle',
                nodeName: 'INPUT',
                type: 'radio',
                elementClasses: [],
                value: 'Bike'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send focus_form and change_form on select change', () => {
    $('#cars').click()
    $('#cars').selectByAttribute('value', 'saab')
    $('#cars').click()

    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'cars',
                nodeName: 'SELECT',
                elementClasses: [],
                value: 'volvo'
              }
            } 
          }
        },
      })
    ).toBe(true)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/change_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'cars',
                nodeName: 'SELECT',
                elementClasses: [],
                value: 'saab'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send focus_form and change_form on textarea input', () => {
    var expectedMessage = 'Changed message';

    $('#message').click()

    // Edge 13 doesn't support setValue so we invert the logic
    // However some browsers don't fire onchange events when clearing...
    if (F.isMatch({ browserName: 'MicrosoftEdge', browserVersion: '25.10586.0.0' }, browser.capabilities)) {
      expectedMessage = '';
      $('#message').clearValue()
    } else {
      $('#message').setValue(expectedMessage)
    }

    $('#lname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'message',
                nodeName: 'TEXTAREA',
                elementClasses: [],
                value: expectedMessage
              }
            } 
          }
        },
      })
    ).toBe(true)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/change_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'message',
                nodeName: 'TEXTAREA',
                elementClasses: [],
                value: ''
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send change_form on checkbox', () => {
    $('#terms').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/change_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                elementId: 'terms',
                nodeName: 'INPUT',
                type: 'checkbox',
                elementClasses: [],
                value: 'agree'
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send submit_form on form submission', () => {
    $('#submit').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/submit_form/jsonschema/1-0-0',
              data: {
                formId: 'myForm',
                formClasses: [ 'formy-mcformface' ],
                elements: [
                  {
                    name: 'message',
                    value: '',
                    nodeName: 'TEXTAREA'
                  },
                  {
                    name: 'fname',
                    value: '',
                    nodeName: 'INPUT',
                    type: 'text'
                  },
                  {
                    name: 'lname',
                    value: 'Doe',
                    nodeName: 'INPUT',
                    type: 'text'
                  },
                  {
                    name: 'vehicle',
                    value: 'Bike',
                    nodeName: 'INPUT',
                    type: 'radio'
                  },
                  {
                    name: 'terms',
                    value: 'agree',
                    nodeName: 'INPUT',
                    type: 'checkbox'
                  },
                  { 
                    name: 'cars', 
                    value: 'saab', 
                    nodeName: 'SELECT' 
                  }
                ]
              }
            } 
          },
          contexts: {
            data: [{
              schema: 'iglu:org.schema/WebPage/jsonschema/1-0-0',
              data: { keywords: ['tester'] }
            }]
          }
        },
      })
    ).toBe(true)
  })

  it('should not send focus_form on excluded element', () => {
    browser.url('/form-tracking.html?filter=exclude')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#fname').click()
    $('#lname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          page_url: 'http://snowplow-js-tracker.local:8080/form-tracking.html?filter=exclude',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'fname',
              }
            } 
          }
        },
      })
    ).toBe(false)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          page_url: 'http://snowplow-js-tracker.local:8080/form-tracking.html?filter=exclude',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'lname',
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send focus_form on included element', () => {
    browser.url('/form-tracking.html?filter=include')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#lname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          page_url: 'http://snowplow-js-tracker.local:8080/form-tracking.html?filter=include',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'lname',
              }
            } 
          }
        },
      })
    ).toBe(true)
  })

  it('should send focus_form on element included by filter', () => {
    browser.url('/form-tracking.html?filter=filter')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#fname').click()
    $('#lname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          page_url: 'http://snowplow-js-tracker.local:8080/form-tracking.html?filter=filter',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'fname',
              }
            } 
          }
        },
      })
    ).toBe(true)

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          page_url: 'http://snowplow-js-tracker.local:8080/form-tracking.html?filter=filter',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'lname',
              }
            } 
          }
        },
      })
    ).toBe(false)
  })

  it('should not send focus_form on elements', () => {
    browser.url('/form-tracking.html?filter=excludedForm')
    browser.waitUntil(
      () => $('#init').getText() === 'true',
      5000,
      'expected init after 5s'
    )
    $('#excluded-fname').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/focus_form/jsonschema/1-0-0',
              data: {
                elementId: 'excluded-fname',
              }
            } 
          }
        },
      })
    ).toBe(false)
  })

  it('should not send submit_form', () => {
    $('#excluded-submit').click()
    // time for activity to register and request to arrive
    browser.pause(5000)
    browser.call(() =>
      fetchResults(docker.url).then(result => {
        log = result
      })
    )

    expect(
      logContains({
        event: {
          event: 'unstruct',
          app_id: 'autotracking',
          unstruct_event: {
            data: {
              schema: 'iglu:com.snowplowanalytics.snowplow/submit_form/jsonschema/1-0-0',
              data: {
                formId: 'excludedForm',
                formClasses: [ 'excluded-form' ]
              }
            } 
          }
        }
      })
    ).toBe(false)
  })
})
