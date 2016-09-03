import {getBoundingClientRect} from "./get-bounding-client-rect"

export class ContentCutter {

    constructor (config) {
        this.config = config
    }

    // main cut method
    cutToFit(contents) {

        let range, overflow, manualPageBreak,
            ignoreLastLIcut = false,
            cutLIs, pageBreak,
            // contentHeight = height of page - height of top floats - height of footnotes.
            contentHeight = (contents.parentElement.clientHeight -
                contents.previousSibling.clientHeight - contents.nextSibling
                .clientHeight),
            contentWidth = contents.parentElement.clientWidth,
            boundingRect, rightCutOff

        // Set height to contentHeight
        contents.style.height = contentHeight + "px"

        // Set height temporarily to "auto" so the page flows beyond where
        // it should end and we can find the page break.
        console.log([contents, contents.parentElement, contentHeight, contents.style.height, contentWidth, contents.style.columnCount])
        contents.style.width = (contentWidth * 2 + 10) + 'px'
        contents.style.columnWidth = contentWidth + 'px'
        contents.style.columnGap = '10px'

        boundingRect = contents.getBoundingClientRect()
        rightCutOff = boundingRect.left + contentWidth + 2


        console.log([boundingRect.left, contentWidth, rightCutOff])
        manualPageBreak = contents.querySelector(this.config[
            'pagebreakSelector'])

        if (manualPageBreak && manualPageBreak.getBoundingClientRect().left <
            rightCutOff) {
            range = document.createRange()
            range.setStartBefore(manualPageBreak)
        } else if (boundingRect.right <= rightCutOff) {
            contents.style.width = contentWidth + "px"
            return false
        } else {
            pageBreak = this.findPageBreak(contents, rightCutOff)
            if (!pageBreak) {
                contents.style.width = contentWidth + "px"
                return false
            }
            range = document.createRange()
            range.setStart(pageBreak.node, pageBreak.offset)
        }

        contents.style.width = contentWidth + "px"
        // We find that the first item is an OL/UL which may have started on the previous page.
        if (['OL','UL'].indexOf(range.startContainer.nodeName) !== -1 || range.startContainer.nodeName ===
            '#text' && range.startContainer.parentNode &&
            ['OL','UL'].indexOf(range.startContainer.parentNode.nodeName) !== -1 &&
            range.startContainer.length === range.startOffset) {
            // We are cutting from inside a List, don't touch the innermost list items.
            ignoreLastLIcut = true
        }
        range.setEndAfter(contents.lastChild)
        overflow = range.extractContents()
        cutLIs = this.countOLItemsAndFixLI(contents)
        if (ignoreLastLIcut) {
            // Because the cut happened exactly between two LI items, don't try to unify the two lowest level LIs.
            cutLIs[cutLIs.length - 1].hideFirstLI = false
            if (cutLIs[cutLIs.length - 1].start) {
                cutLIs[cutLIs.length - 1].start++
            }
        }
        this.applyInitialOLcount(overflow, cutLIs)

        if (!contents.lastChild || (contents.textContent.trim().length ===
                0 && contents.querySelectorAll('img,svg,canvas').length ===
                0)) {
            contents.appendChild(overflow)
            overflow = false
        }
        return overflow
    }


    countOLItemsAndFixLI(element, countList) {
        let start = 1,
            hideFirstLI = false

        if (typeof countList === 'undefined') {
            countList = []
        }
        if (element.nodeName === 'OL') {
            if (element.hasAttribute('start')) {
                start = parseInt(element.getAttribute('start'))
            }
            if (element.lastElementChild.textContent.length === 0) {
                element.removeChild(element.lastElementChild)
            } else {
                start--
                hideFirstLI = true
            }
            countList.push({
                start: start + element.childElementCount,
                hideFirstLI: hideFirstLI
            })
        } else if (element.nodeName === 'UL') {
            if (element.lastElementChild.textContent.length === 0) {
                element.removeChild(element.lastElementChild)
            } else {
                hideFirstLI = true
            }
            countList.push({
                hideFirstLI: hideFirstLI
            })
        }

        if (element.childElementCount > 0) {
            return this.countOLItemsAndFixLI(element.lastElementChild, countList)
        } else {
            return countList
        }

    }

    applyInitialOLcount(element, countList) {
        if (element.nodeName === '#document-fragment') {
            element = element.childNodes[0]
        }
        let listCount
        if (countList.length === 0) {
            return
        }
        if (element.nodeName === 'OL') {
            listCount = countList.shift()
            element.setAttribute('start', listCount.start)
            if (listCount.hideFirstLI) {
                element.firstElementChild.classList.add('hide')
            }
        } else if (element.nodeName === 'UL') {
            listCount = countList.shift()
            if (listCount.hideFirstLI) {
                element.firstElementChild.classList.add('hide')
            }
        }
        if (element.childElementCount > 0) {
            this.applyInitialOLcount(element.firstElementChild, countList)
        } else {
            return
        }
    }

    findPrevNode(node) {
        if (node.previousSibling) {
            return node.previousSibling
        } else {
            return this.findPrevNode(node.parentElement)
        }
    }

    // Go through a node (contents) and find the exact position where it goes
    // further to the right than the right cutoff.
    findPageBreak(contents, rightCutOff) {
        console.log(['findpagebreak',contents, rightCutOff])
        let contentCoords, found, prevNode
        if (contents.nodeType === 1) {
            console.log(['element findbreak',contents, rightCutOff, contents.getBoundingClientRect(), contents.textContent])
            contentCoords = getBoundingClientRect(contents)
            if (contentCoords.left < rightCutOff) {
                if (contentCoords.right > rightCutOff) {
                    console.log('iterating children')
                    found = false
                    let i = 0
                    while (found === false && i < contents.childNodes.length) {
                        found = this.findPageBreak(contents.childNodes[
                            i], rightCutOff)
                        i++
                    }
                    console.log(['done iterating children', found])
                    if (found) {
                        return found
                    }
                } else {
                    return false
                }
            }
            prevNode = this.findPrevNode(contents)
            return {
                node: prevNode,
                offset: prevNode.length ? prevNode.length : prevNode.childNodes.length
            }

        } else if (contents.nodeType === 3) {
            let range = document.createRange(),
                offset = contents.length
            range.setStart(contents, 0)
            range.setEnd(contents, offset)
            contentCoords = range.getBoundingClientRect()
            console.log(['text coords',contentCoords, rightCutOff, contents.textContent])
            if (contentCoords.bottom === contentCoords.top) {
                // A text node that doesn't have any output.
                return false
            } else if (contentCoords.left < rightCutOff) {
                if (contentCoords.right > rightCutOff) {
                    found = false
                    while (found === false && offset > 0) {
                        offset--
                        range.setEnd(contents, offset)
                        contentCoords = range.getBoundingClientRect()
                        if (contentCoords.right <= rightCutOff) {
                            found = {
                                node: contents,
                                offset: offset
                            }
                        }
                    }
                    if (found) {
                        return found
                    }

                } else {
                    return false
                }
            }
            prevNode = this.findPrevNode(contents)
            return {
                node: prevNode,
                offset: prevNode.length ? prevNode.length : prevNode.childNodes
                    .length
            }
        } else {
            return false
        }
    }



}
