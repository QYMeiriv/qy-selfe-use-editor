import * as React from "react";
import styled from "styled-components";

export type Props = {
  commands: Record<string, any>;
};

function SearchBar({ commands }: Props) {
  const [searchText, setSearchText] = React.useState("");
  const [replaceText, setReplaceText] = React.useState("");
  // 查询当前文章字符
  const onSearch = () => {
    commands.find(searchText);
    console.log("查询字符", searchText);
  };

  // // 替换字符
  // const onReplace = () => {
  //   commands.replace(replaceText);
  //   console.log("替换字符", replaceText);
  // };

  // 清除状态
  const onClean = () => {
    commands.clearSearch();
    setSearchText("");
    setReplaceText("");
    console.log("清除状态", commands);
  };

  // 替换全部
  const onReplaceAll = () => {
    commands.replaceAll(replaceText);
    console.log("替换全部");
  };

  return (
    <SearchWrapper>
      <SearchItem>
        <SearchInput type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="输入关键词" />
        <SearchInput type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="输入替换字符" />
        <SearchButton onClick={onSearch}>查找</SearchButton>
        {/* <SearchButton onClick={onReplace}>替换</SearchButton> */}
        <SearchButton onClick={onReplaceAll}>替换全部</SearchButton>
        <SearchButton onClick={onClean}>清除状态</SearchButton>
      </SearchItem>
    </SearchWrapper>
  );
}

const SearchWrapper = styled.div`
  display: flex;
  justify-content: end;
  width: 100%;
`;

const SearchItem = styled.div`
  box-sizing: border-box;
  width: 34rem;
  padding: 10px 13px;
  border-radius: 10px;
  background-color: rgba(0, 0, 0, 0.1);
`;

const SearchInput = styled.input`
  border: 0;
  margin-right: 0.4rem;
  height: 23px;
`;

const SearchButton = styled.button`
  margin-right: 0.4rem;
  padding: 0.2rem 0.5rem;
  font-weight: bold;
  border: 0;
  background-color: rgba(0, 0, 0, 0.1);
  cursor: pointer;
`;

export default SearchBar;
