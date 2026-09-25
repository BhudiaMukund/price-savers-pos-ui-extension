import {render} from 'preact';

export default async () => {
  render(<DeptSaleTile />, document.body);
};

function DeptSaleTile() {
  return (
    <s-tile
      heading="Dept Sale"
      subheading="Casio department keys"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
