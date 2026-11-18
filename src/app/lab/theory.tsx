export default function Theory() {
  return <details className="panel theory" id="lens-theory">
    <summary><strong>Lens theory and diagram guide</strong><small>Use this reference before or during a trial.</small></summary>
    <div className="cards">
      <div><h3>Read the bench</h3><p>The horizontal line is the principal axis. The object is the amber arrow. F marks the focal point on each side of the lens, and 2F marks twice that distance. The grey dashed line on the right is the screen.</p></div>
      <div><h3>Follow the rays</h3><p>The violet ray goes straight through the optical centre. The cyan ray starts parallel to the axis. A convex lens bends it through the far focus. A concave lens bends it away so its backward extension passes through the near focus.</p></div>
      <div><h3>Find the image</h3><p>Where outgoing rays meet, a screen can capture a real image. Where only their backward extensions meet, you see a virtual image by looking through the lens. A screen cannot capture it.</p></div>
    </div>
    <h3>What changes as the object moves?</h3>
    <div className="table-wrap"><table><thead><tr><th scope="col">Lens and object position</th><th scope="col">Image</th></tr></thead><tbody>
      <tr><td>Convex · beyond 2F</td><td>Real, inverted, smaller</td></tr>
      <tr><td>Convex · at 2F</td><td>Real, inverted, same size</td></tr>
      <tr><td>Convex · between F and 2F</td><td>Real, inverted, larger</td></tr>
      <tr><td>Convex · at F</td><td>Parallel outgoing rays, no finite image</td></tr>
      <tr><td>Convex · between lens and F</td><td>Virtual, upright, larger</td></tr>
      <tr><td>Concave · any real object</td><td>Virtual, upright, smaller</td></tr>
    </tbody></table></div>
    <p className="formula">1/f = 1/v − 1/u &nbsp;·&nbsp; m = v/u</p>
    <p><strong>u</strong> is the signed object distance and is negative here. <strong>v</strong> is the signed image distance, positive for real images and negative for virtual images. <strong>f</strong> is positive for convex lenses and negative for concave lenses. A negative magnification <strong>m</strong> means the image is inverted.</p>
  </details>;
}
